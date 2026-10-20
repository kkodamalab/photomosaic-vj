# Phase 3 — 3D / Photo Physics

既存の Phase 1 / 2 を保持し、Canvas2D 上の 2.5D 写真空間と写真球を追加しました。Three.js や大量の剛体は導入していません。最初は PHYSICS MODE = OFF です。

## ライブ操作

各デッキに常時表示する **PHYSICS PERFORMANCE** ボタンを追加しました。対象デッキのパネルを操作すると FX SHORTCUT DECK も切り替わります。

| ボタン／キー  | 動作                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| GATHER / H    | 現在位置・速度から CENTER または POINTER へ吸引し、写真クラスターを作る       |
| CRUMPLE / C   | 現在の写真群を曲げ・回転・縮小しながら球状へ圧縮する                          |
| THROW / T     | ANGLE / POWER / SPIN で現在の球を投げる。先に球化が必要                       |
| BOUNCE / B    | 画面四辺の反射を切り替える                                                    |
| RELEASE / U   | 球を写真群へ展開する。RELEASE AMOUNT を下げれば、球と自由な写真を同時に残せる |
| ASSEMBLE / R  | FREE / MEMORY / BALL から元の PHOTO MOSAIC へ戻す                             |
| RESET PHYSICS | 予約を破棄し、球・速度・奥行き・外力を解除して即復帰する                      |

既存の Space / Enter / Shift+Enter / E / R / G と矢印キーは維持しています。入力欄、textarea、select、button、編集可能領域のフォーカス中は新ショートカットを発動しません。Ctrl / Meta / Alt と組み合わせた新しいキーも横取りしません。

球はプレビュー上でドラッグ可能です。離すと直前のポインタ速度から求めた慣性を引き継ぎます。Esc は従来どおり全画面解除用です。

## PHYSICS 設定

- **MODE**: OFF / MEMORY FIELD / PHOTO PHYSICS。OFF への変更も通常は ASSEMBLE で戻します。即復帰には RESET を使います。
- **WIND MODE**: 2D は Phase 2 のまま。PHYSICS は既存 WIND の方向・強さ・揺らぎ・減衰・回転を写真／球へ渡します。
- **QUALITY**: AUTO / HIGH / MEDIUM / LOW。AUTO は低FPSが2秒程度続くと段階を下げ、余裕が6秒程度続くと戻します。変更対象は物理頻度、写真の表示密度、紙の変形分割数、深度順序の更新頻度です。キャンバス解像度は変更しません。
- **ACTION TIMING**: IMMEDIATE / NEXT BEAT / NEXT BAR。GATHER / CRUMPLE / THROW / RELEASE / ASSEMBLE などのボタン操作を既存 Transport の拍座標へ予約します。RESET は常に即時です。位相・小節リセット後は次の境界へ予約し直します。
- **ANIMATION DURATION**: FREE（秒）/ 1 / 2 / 4 / 8 beats。CRUMPLE と Physics ASSEMBLE に適用します。拍指定は Transport の PAUSE とBPM変更に追従します。CRUMPLE SPEED は FREE 時間の倍率です。
- **ASSEMBLE MODE**: DIRECT / SPRING / SWIRL。Phase 2 EFFECTS の ASSEMBLE MODE と同じ設定です。通常の Phase 2 ASSEMBLE の時間設定は従来どおり別に維持しています。

### MEMORY FIELD

DEPTH / SPREAD / DENSITY / FLOAT SPEED / CAMERA SPEED / CAMERA DEPTH / PERSPECTIVE / CAMERA AUTO を調整できます。タイル位置から滑らかに奥へ開き、写真の縮小・半透明化・前後の重なりで奥行きを表現します。CAMERA AUTO は連続的に写真空間を往復する移動です。

DEPTH MODE = TIME は EXIF がある古い写真を奥、新しい写真を手前に置きます。EXIF のない写真や時刻範囲を作れない場合は安定した疑似乱数配置へフォールバックします。時刻のタイムゾーンが不明な EXIF は中立なタイムラインとして扱い、実行ホストのタイムゾーンに依存させません。完全な TIME TRAVEL UI は未実装です。

物理状態はモザイク格子に対応して保持し、写真空間では原則として各写真の代表シートを表示します。たとえば48列なら物理プールは1,296要素ですが、写真100枚なら代表シートは100枚です。これにより同じ写真をモザイクの繰り返し数だけ重複表示しません。ASSEMBLE では全タイルを戻して元のモザイクを再構成します。

### WIND MEMORY / PHOTO SHEET

独立した WIND MEMORY ON/OFF と DIRECTION / STRENGTH / TURBULENCE / DRAG / LIFT / DEPTH DRIFT / ROTATION を用意しました。GUST は現在位置から風力を増し、滑らかに減衰します。OFF にしても瞬間的には戻しません。

紙の見た目は軽量な1〜3分割描画、bend、curl、回転で表します。布や紙の完全な弾性メッシュシミュレーションではありません。

### PHOTO BALL

球の表面を写真片の球状配置で構成します。全写真の状態を保持し、表示する球面片は最大約180枚、低品質時は約90枚に間引きます。写真を単に小さくして消す処理ではありません。

BALL SIZE / GRAVITY / DRAG / BOUNCE / RESTITUTION / FRICTION / MASS / ANGLE / POWER / SPIN / RELEASE AMOUNT を調整できます。反発係数は 0〜1.2。1超は演出用の加速モードで、暴走防止のため球の速度を約2,200px/sで制限しています。衝突時には軽い squash/stretch を加えます。

球と自由な写真の衝突は、1個の球について写真を線形走査し、軸方向の近傍判定を通ったものだけ距離と衝撃を計算します。写真同士の O(n²) 衝突や完全な3D剛体接触はありません。風の加速は球の大きな質量で割るため、同じ風でも紙より動きにくくなります。

## 必須デモ

### MEMORY

A ONLY、TEXT「風」、写真を読み込み → FLOAT → MODE = MEMORY FIELD → CAMERA AUTO → WIND MEMORY → GUST → ASSEMBLE → FLOAT OFF。元の静止モザイクへ戻ります。

### PHOTO BALL

A ONLY、TEXT「風」→ E（EXPLOSION）→ H（GATHER）→ C（CRUMPLE）→ T（THROW）→ BOUNCE → WIND MEMORY → U（RELEASE）→ ASSEMBLE MODE = SWIRL → R。写真球を経由して元の静止モザイクへ戻ります。Bでも独立して実行できます。

## Phase 4 用 public API

`src/photo-physics.ts` の `PhotoPhysics` は DOM / Effect Engine / Transport の実装に依存しません。コントローラーが時刻と拍を `step(timeMs, beat)` へ渡します。

- `gather(target)`
- `crumple(amount, secondsPerBeat)`
- `holdBall(position, timeMs)` / `releaseBall()`
- `spinBall(angularVelocity)`
- `throwBall(velocity)`
- `applyWind(vector)`
- `releasePhotos(fraction = 1)`
- `assemble(mode, secondsPerBeat)`
- `memoryField()` / `explode(origin, power, spin)` / `gust()` / `reset()`
- `snapshot(photoId)`

座標はデッキのピクセル単位、速度はpx/s、角速度はrad/s、zは奥行き単位です。投影された画面座標を戻すには `unproject(position, depth)` を使います。

コントローラーには型付きの `window.photoVJ` アダプターもあります。デッキ番号は A=0、B=1。現在のボタンと将来のジェスチャーは同じエンジンAPIを呼びます。

```js
photoVJ.gather(0, { x: 640, y: 360 });
photoVJ.crumple(0, 1);
// 球の生成後:
photoVJ.holdBall(0, { x: 500, y: 300 });
photoVJ.spinBall(0, 3);
photoVJ.throwBall(0, { x: 600, y: -250 });
photoVJ.applyWind(0, { x: 100, y: -20, z: 30 });
photoVJ.releasePhotos(0, 1);
photoVJ.assemble(0);
photoVJ.reset(0);
photoVJ.snapshot(0, false); // 軽量な状態・球・カメラ・予約の読み取り
photoVJ.snapshot(0); // シートの位置・速度・回転等も含める
```

ベクトルを直接渡す操作は即時です。GATHER / CRUMPLE / ASSEMBLE のコントローラーアダプターは ACTION TIMING を使います。UIの角度・パワー指定THROWとRELEASEボタンも予約に対応します。複雑な CUE ENGINE は追加していません。

## 出力と制約

Output は Physics を実行せず、Controller の確定済みミキサーフレームを JPEG / BroadcastChannel で受信します。最大30fps、圧縮誤差、転送遅延、Controller のバックグラウンド制限は従来どおりです。

MediaPipe Hands / Face、ジェスチャー認識、音声解析、自動BPM上書き、CUE、タイムライン、AI生成、録画、歌詞表示、楽曲データは追加していません。実写真と実プロジェクターを使う長時間ライブは別途手動確認が必要です。

## Controller action buttons

Each deck exposes GATHER · H, CRUMPLE · C, THROW · T, BOUNCE ON/OFF · B,
RELEASE · U and ASSEMBLE · R both in the always-expanded PHYSICS PERFORMANCE
3-column / 2-row grid and next to their PHYSICS settings. All action buttons
have a minimum 44px height. BOUNCE buttons expose `aria-pressed` and stay in
sync with the existing checkbox and keyboard shortcut.

These controls share the existing `bindPhysics → physicsAction → executePhysics`
path with shortcuts, retaining current configuration and Transport scheduling.
No physics implementation or public API changes are introduced.

`tests/physics-ui-browser.mjs` runs the complete mouse-only explosion / gather /
crumple / throw / bounce / release / swirl assembly demo from both button groups,
checks that it returns to the identical mosaic with zero keydown events, then
checks H/C/T/B/U/R and mobile touch controls. The Pages workflow also runs this
test against the published deployment and uploads its report and screenshots.
