<script>
  export let onSaved; // prop-origin callback — parent owns the wiring

  let text = '';
  let error = '';

  async function submit() {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (res.status === 422) {
      const body = await res.json();
      error = body.error;
      return;
    }
    error = '';
    text = '';
    onSaved();
  }

  function clearForm() {
    text = '';
    error = '';
  }
</script>

<form on:submit|preventDefault={submit}>
  <label for="note">Your feedback</label>
  <textarea id="note" bind:value={text} maxlength="500" required></textarea>
  {#if error}<p role="alert">{error}</p>{/if}
  <button type="submit">Submit</button>
  <button type="button" on:click={clearForm}>Clear</button>
</form>

<a href="#top">Back to top</a>
