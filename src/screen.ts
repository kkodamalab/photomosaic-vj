import "./style.css";
const canvas = document.querySelector<HTMLCanvasElement>("canvas")!,
  ctx = canvas.getContext("2d")!;
const channel = new BroadcastChannel("photo-vj-output");
let generation = 0;
channel.onmessage = async ({ data }) => {
  if (data.type !== "frame") return;
  const current = ++generation;
  const image = await createImageBitmap(data.blob);
  if (current !== generation) {
    image.close();
    return;
  }
  canvas.width = image.width;
  canvas.height = image.height;
  ctx.drawImage(image, 0, 0);
  image.close();
  channel.postMessage({ type: "ready" });
};
channel.postMessage({ type: "ready" });
setInterval(() => channel.postMessage({ type: "hello" }), 2000);
canvas.addEventListener("dblclick", () => canvas.requestFullscreen());
