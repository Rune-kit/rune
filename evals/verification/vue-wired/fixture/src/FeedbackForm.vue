<script setup>
import { ref } from 'vue';

const props = defineProps({ onSaved: Function }); // prop-origin callback — parent owns the wiring

const text = ref('');
const error = ref('');

async function submit() {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: text.value }),
  });
  if (res.status === 422) {
    const body = await res.json();
    error.value = body.error;
    return;
  }
  error.value = '';
  text.value = '';
  props.onSaved();
}

function clearForm() {
  text.value = '';
  error.value = '';
}
</script>

<template>
  <form @submit.prevent="submit">
    <label for="note">Your feedback</label>
    <textarea id="note" v-model="text" maxlength="500" required></textarea>
    <p v-if="error" role="alert">{{ error }}</p>
    <button type="submit">Submit</button>
    <button type="button" @click="clearForm">Clear</button>
  </form>
  <a href="#top">Back to top</a>
</template>
