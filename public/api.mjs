export async function requestLocal(path, options={}) {
  try {
    return await fetch(path, {...options, signal: AbortSignal.timeout(5000)});
  } catch (cause) {
    throw new Error('The local ShelfSentinel server is unavailable. Run npm start in the repository, keep that terminal open, then reload http://127.0.0.1:8787. Your video stays local.', {cause});
  }
}
