<script>
  import FeedbackForm from './FeedbackForm.svelte';

  let notes = [];

  async function loadFeedback() {
    const res = await fetch('/api/feedback');
    notes = await res.json();
  }

  loadFeedback();
</script>

<main id="top">
  <h1>Feedback Board</h1>
  <FeedbackForm onSaved={loadFeedback} />
  <ul aria-live="polite">
    {#each notes as n (n.id)}
      <li>{n.text}</li>
    {/each}
  </ul>
</main>
