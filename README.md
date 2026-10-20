# PHOTO VJ STUDIO — Phase 1

ブラウザ内でイベント写真をモザイク化し、2デッキで合成するVJアプリです。

- Controller: https://kkodamalab.github.io/photomosaic-vj/controller.html
- Output: https://kkodamalab.github.io/photomosaic-vj/screen.html

## 起動

Node.js 22.12以上を使用します。

```sh
npm ci
npm run dev
npm test
npm run build
```

ブラウザ検証: 開発サーバー起動後 `node tests/browser.mjs`。WindowsのEdgeを使用します。別環境ではテスト先の実行ファイルパスを変更してください。`TEST_URL` でテスト対象を変更できます。

## 演奏

1. 写真またはフォルダを追加します。JPG / PNG / WebPに対応します。
2. Deck A/Bに文字列またはターゲット画像を設定します。
3. SPLIT / OVERLAY / CROSSFADEで合成します。A ONLY / B ONLY、SWAP、FREEZEも利用できます。
4. Spaceを4回以上タップしてBPMを合わせ、Enterで拍頭、Shift+Enterで小節頭を合わせます。音声入力は不要です。
5. OUTPUT WINDOWを開き、別モニターに移動します。出力画面をダブルクリックして全画面表示します。

入力欄・ボタンにフォーカスがある間はキーボードショートカットを停止します。空白部分をクリックしてから演奏してください。矢印キー左右でSPLIT位置、上下でOVERLAY透明度を変更できます。Escはブラウザ標準の全画面解除です。

写真はこのオリジンのIndexedDBに縮小版として保存されます。読み込みは逐次Web Worker処理、デコード済みサムネイルはA/B共用です。外部送信しません。全削除でキャッシュを削除できます。保存容量超過や破損画像は読み込みエラー数に表示します。

## 範囲と制約

Phase 1のみ実装しています。写真なしでは文字ターゲットの色タイルを表示し、写真を追加すると実画像のモザイクになります。

- 写真の平均RGB、明度、彩度、24-binヒストグラム、JPEG EXIF撮影日時を保存。日時がない場合はnull。時間帯は明度からの粗い推定です。
- EXIF Orientationはブラウザの `createImageBitmap` に任せます。撮影日時はタイムゾーン不明のローカル日時文字列です。JPEG以外の日時メタデータは未対応。
- 元画像は保存せず、長辺256pxの縮小画像を保存します。1000枚のメモリ使用量は画像比率・ブラウザによって変わります。
- 重複OFFで写真数よりタイル数が多い場合、余ったタイルは背景になります。
- 出力画面はコントローラーの完成フレームを受信します。出力は最大30fps、JPEG圧縮・転送遅延あり。コントローラーは表示し続けてください。最小化時やバックグラウンド時はブラウザの制限で停止・低速化することがあります。
- 位相は単調増加時計で計算するためフレーム落ちでも拍位置を維持します。別画面では時計を独立実行せず、同じ合成結果を表示します。
- 顔解析・手指操作・Three.jsの3D・音声解析・録画・CUE・汎用エフェクト・プリセットは後続Phaseです。AI PROMPTは未接続と明記しています。

設計: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。検証: [docs/VALIDATION.md](docs/VALIDATION.md)。
