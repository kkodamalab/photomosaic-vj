# モジュール設計

## Phase 1の実装

|領域|ファイル|責務|
|---|---|---|
|PHOTO DATABASE|src/database.ts, src/photo.worker.ts, src/exif.ts|逐次画像解析、縮小、IndexedDB、メタデータ|
|CONTENT ENGINE|src/types.ts, src/renderer.ts の Mosaic|ContentPluginライフサイクル、文字/画像ターゲット、色距離による写真選択|
|AUDIO SYNC|src/transport.ts|手動Transport、タップ中央値、位相、小節、ロック、NUDGE|
|DUAL-DECK MIXER|src/renderer.ts の Renderer|独立バッファの合成、共有サムネイル、FREEZE|
|CONTROLLER|src/main.ts|入力と状態、ライブUI、写真管理、BroadcastChannel送信|
|OUTPUT|src/screen.ts|合成フレーム受信、16:9表示、全画面|

`ContentPlugin.render(RenderFrame)` と `dispose()` を共通ライフサイクルとします。RenderFrameに絶対時刻、拍位置、デッキ設定を渡します。今後のコンテンツレジストリでプラグインを差し替える予定です。現在のRendererはMosaicのみ生成します。

A/Bは写真ビットマップを共用し、ターゲットとタイル対応表は独立保持します。対応表は設定・写真変更時のみ計算します。フレームごとの全写真探索は行いません。非重複選択では不足分を背景色にします。

## 全体の拡張設計（未実装）

1. **EFFECT ENGINE**: 各ContentPluginの描画後、デッキ合成前にエフェクトチェーンを適用。EffectConfigには強度、速度、方向、同期周期、位相を保持。
2. **FACE FX ENGINE**: Databaseに顔領域・ランドマーク・解析バージョンを追加。写真テクスチャ提供層で加工し、各コンテンツが共用。自然な表情生成と簡易ランドマーク変形を区別する。
3. **GESTURE ENGINE**: MediaPipeの低頻度認識を描画から分離。平滑化・保持時間・終了猶予・優先順位・クールダウン後にtimestamp付きActionを発行。映像は送信しない。
4. **PHYSICS ENGINE**: コントローラーのみ固定刻みで更新。共通オブジェクトIDに紙片・球体・粒子の状態と速度を保持。THROW/BOUNCE/WIND/TOUCHの切替でも同じIDを継続。2.5D接触を先行。
5. **PRESET / CUE ENGINE**: バージョン付きシリアライズ可能設定を保存。画像はID参照。即時/次拍/次小節ActionをTransportの拍座標で予約。BPM/位相維持を指定可能にする。
6. **AUDIO SYNC拡張**: AudioContext + AnalyserNodeでRMS/帯域/Onsetを解析。MANUALを初期値にし、推定BPMは明示AUTOかつ信頼度閾値を満たす場合のみ更新。
7. **OUTPUT / RECORDING拡張**: コントローラーの合成canvasからMediaRecorderに渡す。出力転送は将来WebRTC等の低遅延方式へ変更可能。
8. **TIMELINE**: CueActionに拍・開始時刻・継続時間・楽曲再生位置の任意フィールドを付与する。

## 時計と出力の権威

Transportは `performance.now()` から連続拍位置を計算します。BPM変更時は既存の拍位置が同じになるよう原点を補正します。Enterは現在の拍番号を保った位相リセット、Shift+Enterは拍番号0へのリセットです。ロックはBPM変更を防ぎ、位相調整は許可します。

現段階では時計オフセット推定は不要です。出力画面は描画/物理/位相を再計算しません。完成フレームに `performance.timeOrigin + now` とTransport状態を添付し、受信順の新しいフレームのみ表示します。30fps上限で、同期内容のずれを避けますが転送遅延を除去する方式ではありません。コントローラーは1つだけ起動してください。複数コントローラー間の所有権調停は未実装です。

## 公開

Vite baseは `/photomosaic-vj/`。index/controller/screenをマルチページビルドし、GitHub Actionsで単体テスト・型検査・ビルド後にPagesへ配置します。ブラウザのメディア・IndexedDBにはHTTPSまたはlocalhostを使用します。
