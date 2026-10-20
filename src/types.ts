export type RGB = [number, number, number];
export interface Photo {
  id: string;
  name: string;
  blob: Blob;
  width: number;
  height: number;
  rgb: RGB;
  brightness: number;
  saturation: number;
  histogram: number[];
  capturedAt: string | null;
  timeOfDay: string;
  excluded: boolean;
  faceStatus: "not-analyzed";
}
export type Deck = {
  text: string;
  target: "text" | "image";
  font: string;
  fontSize: number;
  bold: boolean;
  align: CanvasTextAlign;
  lineHeight: number;
  color: string;
  background: string;
  columns: number;
  gap: number;
  mode: "original" | "balanced" | "precise";
  correction: number;
  randomness: number;
  repeat: boolean;
  zoom: number;
  rotation: number;
  scatter: number;
  image?: HTMLImageElement;
};
export type Mixer = {
  mode: "split" | "overlay" | "crossfade" | "a" | "b";
  amount: number;
  opacity: number;
  axis: "horizontal" | "vertical";
  blend: GlobalCompositeOperation;
  swap: boolean;
  freeze: boolean;
};
export const defaultDeck = (text: string): Deck => ({
  text,
  target: "text",
  font: "sans-serif",
  fontSize: 210,
  bold: true,
  align: "center",
  lineHeight: 1.1,
  color: "#f5eee0",
  background: "#11131a",
  columns: 48,
  gap: 1,
  mode: "balanced",
  correction: 0.48,
  randomness: 0.08,
  repeat: true,
  zoom: 1,
  rotation: 0,
  scatter: 0,
});
export interface ContentPlugin {
  id: string;
  render(ctx: CanvasRenderingContext2D, frame: RenderFrame): void;
  dispose(): void;
}
export interface RenderFrame {
  width: number;
  height: number;
  beat: number;
  time: number;
  deck: Deck;
}
// Future engines subscribe to timestamped transport snapshots, never to render-frame counts.
export interface Engine {
  dispose(): void;
}
