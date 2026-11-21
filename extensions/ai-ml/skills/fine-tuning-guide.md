---
name: "fine-tuning-guide"
pack: "@rune/ai-ml"
description: "Fine-tuning workflows — dataset preparation, training configuration, evaluation metrics, deployment, A/B testing."
model: sonnet
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

# fine-tuning-guide

Fine-tuning workflows — dataset preparation, training configuration, evaluation metrics, deployment, A/B testing.

#### Workflow

**Step 0 — Pick the training path (check availability first)**
Hosted fine-tuning availability changes fast — confirm on the provider's docs before emitting code. As of 2026-11 (developers.openai.com/api/docs/guides/supervised-fine-tuning and /deprecations): OpenAI is winding down self-serve fine-tuning — closed to organizations that never fine-tuned (May 7, 2026), new jobs end for everyone on **Jan 6, 2027**, and only `gpt-4.1-2025-04-14` / `gpt-4.1-mini-2025-04-14` remain trainable (both shut down Jan 14, 2027; `gpt-4.1-nano` shut down Oct 23, 2026). Default to **open-weight LoRA** (Hugging Face TRL + PEFT) unless the user already has an active OpenAI fine-tuning org and a deadline that fits. Before fine-tuning at all, confirm that prompting, few-shot examples, or retrieval cannot reach the target quality.

**Step 1 — Audit training data**
Use Read to examine the dataset files. Check for: data format (JSONL with `messages` array), train/eval split (eval must not overlap with train), sufficient examples (minimum 50, recommended 200+), balanced class distribution, and PII in training data.

**Step 2 — Prepare and validate dataset**
Emit: JSONL formatter that validates each example, train/eval splitter with stratification, token count estimator (cost preview), and data quality checks (duplicate detection, format validation).

**Step 3 — Execute fine-tuning and evaluate**
Emit: training call for the path chosen in Step 0 (TRL/PEFT LoRA config, or the legacy OpenAI job with a supported snapshot), evaluation script that compares base vs fine-tuned on held-out set, and A/B deployment configuration.

#### Example

```python
# Fine-tuning workflow — prepare, train, evaluate
import json
from sklearn.model_selection import train_test_split

# Step 1: Prepare JSONL dataset
def prepare_dataset(examples: list[dict], output_prefix: str):
    train, eval_set = train_test_split(examples, test_size=0.2, random_state=42)

    for split_name, split_data in [("train", train), ("eval", eval_set)]:
        path = f"{output_prefix}_{split_name}.jsonl"
        with open(path, "w") as f:
            for ex in split_data:
                f.write(json.dumps({"messages": [
                    {"role": "system", "content": ex["system"]},
                    {"role": "user", "content": ex["input"]},
                    {"role": "assistant", "content": ex["output"]},
                ]}) + "\n")
        print(f"Wrote {len(split_data)} examples to {path}")

# Step 2a (default): open-weight LoRA with Hugging Face TRL + PEFT
# Docs: huggingface.co/docs/trl/sft_trainer — conversational JSONL ("messages") works as-is.
def start_lora_fine_tune(train_file: str, eval_file: str, base_model: str = "Qwen/Qwen3-0.6B"):
    from datasets import load_dataset
    from peft import LoraConfig
    from trl import SFTConfig, SFTTrainer

    data = load_dataset("json", data_files={"train": train_file, "eval": eval_file})
    trainer = SFTTrainer(
        model=base_model,
        args=SFTConfig(output_dir="ft-out", num_train_epochs=3, assistant_only_loss=True),
        train_dataset=data["train"],
        eval_dataset=data["eval"],
        peft_config=LoraConfig(),
    )
    trainer.train()
    trainer.save_model("ft-out")  # LoRA adapter; serve with vLLM/TGI or merge into the base
    return "ft-out"

# Step 2b (legacy, existing OpenAI fine-tuning customers only, jobs end Jan 6, 2027)
def start_openai_fine_tune(train_file: str, eval_file: str):
    import openai

    train_id = openai.files.create(file=open(train_file, "rb"), purpose="fine-tune").id
    eval_id = openai.files.create(file=open(eval_file, "rb"), purpose="fine-tune").id

    job = openai.fine_tuning.jobs.create(
        training_file=train_id,
        validation_file=eval_id,
        model="gpt-4.1-mini-2025-04-14",  # base shuts down Jan 14, 2027 — the fine-tune goes with it
        hyperparameters={"n_epochs": 3, "batch_size": "auto", "learning_rate_multiplier": "auto"},
    )
    print(f"Fine-tuning job: {job.id} — status: {job.status}")
    return job

# Step 3: Evaluate base vs fine-tuned on the held-out set
# `generate(model, messages) -> str` wraps whichever runtime serves the models
# (vLLM/TGI for a LoRA adapter, the OpenAI client for path 2b).
def evaluate(generate, base_model: str, ft_model: str, eval_set: list[dict]) -> dict:
    results = {"base": {"correct": 0}, "finetuned": {"correct": 0}}
    for ex in eval_set:
        for label, model in [("base", base_model), ("finetuned", ft_model)]:
            answer = generate(model, ex["messages"][:2])
            if answer.strip() == ex["messages"][2]["content"].strip():
                results[label]["correct"] += 1
    for label in results:
        results[label]["accuracy"] = results[label]["correct"] / len(eval_set)
    return results
```
