# Phase 1 検証報告

検証日: 2026-10-20 (JST)

## 成功した検証

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

## 検証上の制限

1,000枚試験は12種の生成画像を複製したJPEGファイルを使用しています。実イベントの高解像度写真1,000枚、全メーカーのEXIF、破損ファイルの全形式、Chrome実行、物理プロジェクター、長時間ライブ演奏は未検証です。スクリーン出力は圧縮フレーム転送のため最大30fpsで、別画面の遅延・最小化時のスロットリングが残ります。60fps保証や計測済み遅延値はありません。

フォルダピッカーはwebkitdirectory経由、全画面はブラウザAPI経由で実装しています。OSのフォルダ選択ダイアログ、外部ディスプレイでの全画面化は手動確認が必要です。写真を外部へ送信するアプリ処理はありません。

## 未実装（予定どおりPhase 2以降）

他の写真コンテンツ、共通エフェクトチェーン、プリセット/CUE、Three.js 3D、物理、手指操作、顔検出/顔加工、音声入力/自動BPM、録画、タイムライン。顔解析メタデータは `not-analyzed` と記録します。AI PROMPTは未接続です。

## 次Phase

ユーザーの指示後にPhase 2: PHOTO WAVE / TYPOGRAPHY / KALEIDOSCOPE / GLITCH、エフェクトチェーン、プリセットを実装する。先に実イベント写真とプロジェクターでPhase 1の動作・出力遅延を確認することを推奨します。
