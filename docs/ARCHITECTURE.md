# モジュール設計

## Phase 1の実装

| 領域            | ファイル                                          | 責務                                                                   |
| --------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| PHOTO DATABASE  | src/database.ts, src/photo.worker.ts, src/exif.ts | 逐次画像解析、縮小、IndexedDB、メタデータ                              |
| CONTENT ENGINE  | src/types.ts, src/renderer.ts の Mosaic           | ContentPluginライフサイクル、文字/画像ターゲット、色距離による写真選択 |
| AUDIO SYNC      | src/transport.ts                                  | 手動Transport、タップ中央値、位相、小節、ロック、NUDGE                 |
| DUAL-DECK MIXER | src/renderer.ts の Renderer                       | 独立バッファの合成、共有サムネイル、FREEZE                             |
| CONTROLLER      | src/main.ts                                       | 入力と状態、ライブUI、写真管理、BroadcastChannel送信                   |
| OUTPUT          | src/screen.ts                                     | 合成フレーム受信、16:9表示、全画面                                     |

`ContentPlugin.render(RenderFrame)` と `dispose()` を共通ライフサイクルとします。RenderFrameに絶対時刻、拍位置、デッキ設定を渡します。今後のコンテンツレジストリでプラグインを差し替える予定です。現在のRendererはMosaicのみ生成します。

A/Bは写真ビットマップを共用し、ターゲットとタイル対応表は独立保持します。対応表は設定・写真変更時のみ計算します。フレームごとの全写真探索は行いません。非重複選択では不足分を背景色にします。

## 全体の拡張設計（未実装）

1. **EFFECT ENGINE**: Phase 2でタイル変換と画像後処理を実装（下記参照）。追加の効果は同じ段階へ拡張可能。
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

## Phase 2: Effect Chain

`CONTENT → TILE EFFECTS → FRAME EFFECTS → DECK BUFFER → MIXER → OUTPUT` の順で処理します。

- `src/effects.ts`: `EffectConfig` / `Effects`、デッキ固有の `EffectChain`。PULSE / WAVE / FLOAT はタイルの基準位置を変更せず描画変換を返します。WIND / GUST / EXPLOSION は Float64Array にタイルごとの位置オフセット・速度・回転・角速度を保持します。物理積分は1/120秒刻み、1描画の追従は最大250msに制限します。
- `src/frame-effects.ts`: GLITCH と RGB SHIFT を完成したデッキ画像へ適用。再利用する2枚の補助Canvasでスライス移動・チャンネル合成を行い、毎フレームの画素読み戻しを避けます。
- `src/effects-ui.ts`: 共通設定に基づく折りたたみUI、パラメータ入力とアクションの接続。
- `RenderFrame.tileTransform`: Content と Effects の境界。Mosaic は個別エフェクト名を知りません。将来の Content は同じ変換プロバイダを利用できます。
- `Renderer`: デッキごとに独立した EffectChain / FrameEffects を所有。静止時は従来の描画キャッシュを維持します。アニメーション終了時も最後の静止フレームを必ず再描画します。動くタイルには色補正済みのモザイク画像をアトラスとして再利用し、写真選択と色補正を毎フレーム繰り返しません。A/B は引き続きデコード済みサムネイルを共有します。

ASSEMBLED / FLOATING / WIND / EXPLODING / ASSEMBLING を表示状態として返します。新たな操作は現在位置・速度から引き継ぎます。DIRECT は初速を引き継ぐ補間、SPRING は減衰振動、SWIRL は補間経路を回転させて戻ります。戻り中の解像度・列数変更時には位置と戻り開始状態を新しい格子へ対応付けます。

同期エフェクトは既存 `Transport.beat()` の値を使用します。独立したBPM時計は持ちません。拍指定 ASSEMBLE の進捗は経過拍数から計算し、BPM変更と一時停止に追従します。位相リセット時は経過拍の基準を置き直し、戻りの進捗が逆転しないようにします。FREE は実時間の秒数です。

出力側は EffectChain を実行しません。ミキサーの最終Canvasを既存のJPEG / BroadcastChannel経路で送るため、すべての新しい効果を含む同じ完成画面を受信します。最大30fps、圧縮誤差、転送遅延、バックグラウンド制限は従来どおり残ります。

将来の FACE / HAND / PHYSICS / AUDIO REACTIVE は、ContentPlugin・タイル変換・フレーム処理のいずれかの段階へ追加できます。今回それらの機能を実装したわけではありません。

## Phase 3: Photo Physics

`CONTENT → EFFECT TRANSFORMS → PHYSICS PROJECTION → DECK → FRAME FX → MIXER → OUTPUT`。

- `physics-config.ts`: 型、デッキ固有の初期設定、EXIF時刻→depthの純粋API。
- `photo-physics.ts`: DOMを持たない軽量エンジン。写真のhome / position / velocity / acceleration、rotation / angularVelocity、mass / drag / gravity / restitution / friction、scale / bend / curl / stateをTypedArrayで保持。球は1個の物理状態と共有する球面座標で表す。
- `physics-actions.ts`: Transport拍座標の小さな操作予約キュー。独立BPM時計を作らず、拍リセットで次の境界へ予約を置き直す。RESETで即破棄。
- `physics-view.ts`: EffectChainの結果とPhysicsの投影を合成するアダプター。両エンジンは互いをimportしない。紙の軽量分割描画もここに置く。
- `physics-ui.ts`: 設定パネルと常時アクセスできるライブ操作ボタン。
- `Renderer`: A/Bに独立エンジンとアダプターを所有。通常モードでは物理更新を実行せず、Phase 1/2のキャッシュを維持。物理開始時に既存飛散・WINDの位置と速度を移して連続性を保つ。
- `main.ts`: ボタン／キー／ポインタと型付きwindow.photoVJを、同じエンジンのpublic APIへ接続。API詳細はPHASE3.mdを参照。

物理はHIGH=120Hz、MEDIUM=90Hz、LOW=60Hzの固定刻み。1フレームの追従は最大200ms。球と写真の近傍判定はO(n)、写真同士の総当たりは行わない。質量の大きな球には風が弱く作用し、壁面反射では反発・摩擦・squashを更新する。

MEMORY FIELDは元タイルから連続して3軸へ展開し、zに基づく遠近・不透明度・深度順描画を行う。紙は最大3分割、球面片は最大約180枚の表示LODを使い、元のサムネイルを共用する。AUTO品質は物理頻度・表示密度・変形・順序更新だけを調整し、映像解像度を変更しない。

GATHERは現在位置からの吸引、CRUMPLEは現在位置から球面へ補間、RELEASEは球の並進・回転速度を引き継ぐ展開、ASSEMBLEはDIRECT / SPRING / SWIRLでhomeへ戻す。中断・RESET・格子／解像度変更でも状態を引き継ぐか安全に解除する。Output側には新たなシミュレーションを置かない。
