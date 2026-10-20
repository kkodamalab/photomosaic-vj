# 検証報告

## Phase 2: Dynamic Photo FX

検証日: 2026-10-20 (JST)。Node.js 24.19.0、Chromium 154.0.8037.57 headless、1280×720、48列・1,296タイル。ローカルの本番ビルドで検証しました。

- 変更前: ローカル Phase 1 の単体11件、型検査、ビルド、ブラウザ14項目が成功。公開済み Phase 1 に対してもブラウザ14項目が成功。
- 変更後: lint（Prettier）、TypeScript strict 型検査、単体27件、ビルドが成功。
- Canvas2Dエンジン検証10項目が成功。RGBの各チャンネル分離、爆発の画素変化、途中の再集合、アニメーション完了直後の最終フレーム、GLITCH解除、FREEZEの状態保持を検証。
- 既存Phase 1ブラウザ14項目を維持し、変更後の本番ビルドでも成功。1,000枚の読み込み・Worker解析・IndexedDB復元・A/B・ミキサー・出力・モバイル幅を含みます。
- Phase 2ブラウザ28項目が成功。PULSE / WAVE / FLOAT / GLITCH / RGB SHIFT のON/OFFと時間経過による画素差、WAVEの4方向、WIND OFF後の位置保持、GUST、3種類の再集合、POINTER爆心地、E/R/Gの入力欄保護と実操作、BPM変更・PAUSE・PHASE RESETとの同期を確認。
- Deck A/Bの独立性と、それぞれで「風」→ FLOAT → WAVE → 同期PULSE → GUST → WIND → EXPLOSION → SWIRL / 4 beats → 元位置というデモを確認。
- Controllerの完成画面とOutputの同一フレームを画素比較。JPEG転送後の平均チャンネル誤差は10.63/255（同じサンプル位置を比較）。動くエフェクトがOutputにも継続して届くことを確認。ブラウザ実行時例外0件。

### 負荷試験

12種類の生成JPEGを複製して入力しました。各計測は3秒、Controllerを前面にしたrequestAnimationFrame実測です。写真数と描画タイル数は別です。A/Bの縮小画像は共有し、全画像を高解像度テクスチャとして常駐させません。

| 写真数 | エフェクト                |            FPS | フレーム時間p95 |
| ------ | ------------------------- | -------------: | --------------: |
| 1,000  | OFF（既存の静止モザイク） | 60（画面表示） |          未計測 |
| 100    | FLOAT + WAVE + 同期PULSE  |           45.6 |          33.4ms |
| 1,000  | FLOAT + WAVE + PULSE      |           47.6 |          33.4ms |
| 1,000  | 上記 + GLITCH + RGB SHIFT |           25.2 |          50.1ms |

詳細な項目・実測値: [phase2-test-results.json](phase2-test-results.json)。試行間には約32〜48fpsの変動があり、動的エフェクトで60fpsを保証する結果ではありません。RGB SHIFTなどの複数Canvas合成はソフトウェア描画環境で負荷が増えます。実機のGPU、解像度、併用数に応じた調整が必要です。

### 再実行

`npm run dev` を起動して `npm run test:browser`。本番ビルドでは `npm run build` 後に `npx vite preview --host 127.0.0.1 --port 4173 --strictPort` を起動し、`TEST_URL` にそのベースURLを指定して `node tests/browser.mjs` と `node tests/phase2-browser.mjs` を実行します。`tests/renderer-browser.mjs` のソースモジュール検証はVite開発サーバー専用です。

### 制約・未実装

- 物理プロジェクター、OSのフォルダダイアログ・全画面、実イベントの高解像度写真、長時間ライブは未検証。
- 出力転送は最大30fps・JPEG圧縮・転送遅延あり。Controllerを前面で動かしてください。
- MediaPipe Hands / Face、CRUMPLE / THROW / BOUNCE、音声BPM解析、CUE、タイムライン、プリセット、録画、AI生成は未実装。
- 次は実機・実写真で長時間運用と出力遅延を測定し、必要なら画像後処理のGPU化や表示品質切替を検討します。機能追加はその後、別途指示されたPhaseで行います。

## Phase 1 検証報告（履歴）

検証日: 2026-10-20 (JST)

### 成功した検証

- `npm test`: Transport単体テスト11件成功。500msタップ、外れ値、BPM変更時の拍連続性、PHASE/BAR RESETの区別、LOCK、NUDGE、フレーム落ち、TAPリセット、PAUSE/RESUME、範囲制限。
- `npm run build`: TypeScript strict型検査・Viteマルチページビルド成功。
- `npm audit`: 脆弱性0件（更新後）。
- Windows Microsoft Edge headlessでブラウザ試験14項目成功。詳細は `browser-test-results.json`。
- 1,000枚の生成JPEGテスト画像をファイル入力から実際に読み込み、Worker解析・IndexedDB保存・モザイク描画を実行。
- 写真除外・再追加、TEXT/IMAGEターゲットの独立性、A/Bの画素差、SPLIT/OVERLAY/CROSSFADE操作による画素変化、FREEZE、別screen受信、リロード後のキャッシュ復元を確認。
- 390px幅で横スクロールがないことを確認。
- 前面コントローラーの静止モザイクはテスト環境で60 FPS表示を確認（保証値ではない）。
- ブラウザの実行時例外0件。
- `controller-tested.png` を目視し、主要パネル・操作・ライブラリの配置を確認。

### 検証上の制限

1,000枚試験は12種の生成画像を複製したJPEGファイルを使用しています。実イベントの高解像度写真1,000枚、全メーカーのEXIF、破損ファイルの全形式、Chrome実行、物理プロジェクター、長時間ライブ演奏は未検証です。スクリーン出力は圧縮フレーム転送のため最大30fpsで、別画面の遅延・最小化時のスロットリングが残ります。60fps保証や計測済み遅延値はありません。

フォルダピッカーはwebkitdirectory経由、全画面はブラウザAPI経由で実装しています。OSのフォルダ選択ダイアログ、外部ディスプレイでの全画面化は手動確認が必要です。写真を外部へ送信するアプリ処理はありません。

### 未実装（予定どおりPhase 2以降）

他の写真コンテンツ、共通エフェクトチェーン、プリセット/CUE、Three.js 3D、物理、手指操作、顔検出/顔加工、音声入力/自動BPM、録画、タイムライン。顔解析メタデータは `not-analyzed` と記録します。AI PROMPTは未接続です。

### 次Phase

この記録はPhase 1完了時の履歴です。Phase 2の実装範囲と現在の検証結果は上記およびPHASE2.mdを参照してください。
