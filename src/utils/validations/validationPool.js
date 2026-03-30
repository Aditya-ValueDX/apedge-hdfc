export class ValidationPool {
  constructor(maxWorkers = 4, workerFile = './validationWorker.js') {
    this.maxWorkers = maxWorkers;
    this.workerFile = workerFile;
    this.workers = [];
    this.queue = [];
    this.idleWorkers = [];
  }

  init() {
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(new URL(this.workerFile, import.meta.url));
      worker.onmessage = (e) => this._onWorkerMessage(worker, e.data);
      this.workers.push(worker);
      this.idleWorkers.push(worker);
    }
  }

  _onWorkerMessage(worker, result) {
    const resolve = worker.currentResolve;
    if (resolve) resolve(result);

    worker.currentResolve = null;
    this.idleWorkers.push(worker);

    // Check if more tasks are queued
    if (this.queue.length > 0) {
      const { field, value, code, resolve } = this.queue.shift();
      this._runTask(worker, field, value, code, resolve);
    }
  }

  _runTask(worker, field, value, code, resolve) {
    worker.currentResolve = resolve;
    worker.postMessage({ field, value, code });
  }

  runValidation(field, value, code) {
    return new Promise((resolve) => {
      const worker = this.idleWorkers.shift();
      if (worker) {
        this._runTask(worker, field, value, code, resolve);
      } else {
        this.queue.push({ field, value, code, resolve });
      }
    });
  }

  async runAll(validations) {
    // validations = [{ field, value, code }]
    const promises = validations.map(v =>
      this.runValidation(v.field, v.value, v.code)
    );
    return Promise.all(promises);
  }

  terminate() {
    this.workers.forEach((w) => w.terminate());
    this.workers = [];
    this.idleWorkers = [];
    this.queue = [];
  }
}
