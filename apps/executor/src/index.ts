import 'dotenv/config';

const port = Number(process.env.EXECUTOR_PORT ?? 4001);

console.log(`Executor base initialized on port ${port}.`);
console.log('Sandboxed execution will be implemented in a future phase.');

export const executorStatus = {
  ok: true,
  service: 'ciesa-executor',
  port,
  mode: 'standby'
};
