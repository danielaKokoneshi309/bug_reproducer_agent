type Job = () => Promise<void>;

const queue: Job[] = [];
let processing = false;

export function addJob(job: Job) {
  queue.push(job);
  processQueue();
}

async function processQueue() {
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const job = queue.shift();
    if (job) {
      try {
        await job();
      } catch (e) {
        console.error("Job failed:", e);
      }
    }
  }
  processing = false;
}
