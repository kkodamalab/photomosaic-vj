import { analyze } from "./database";
self.onmessage = async (e: MessageEvent<File>) => {
  try {
    self.postMessage({ photo: await analyze(e.data) });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
