<script setup>
import { ref } from 'vue';
import FeedbackForm from './FeedbackForm.vue';

const notes = ref([]);

async function loadFeedback() {
  const res = await fetch('/api/feedback');
  notes.value = await res.json();
}

loadFeedback();
</script>

<template>
  <main id="top">
    <h1>Feedback Board</h1>
    <FeedbackForm :onSaved="loadFeedback" />
    <ul aria-live="polite">
      <li v-for="n in notes" :key="n.id">{{ n.text }}</li>
    </ul>
  </main>
</template>
