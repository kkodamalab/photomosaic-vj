# Phase 2: Dynamic Photo FX

Phase 1 の PHOTO MOSAIC・写真データベース・TEXT/IMAGE・マッチング・手動 Transport・ミキサー・出力転送を維持し、デッキごとに EFFECTS パネルを追加しました。初期状態では全エフェクト OFF です。

## 操作

A/B 各パネルの EFFECTS を開き、各項目を展開します。複数の ON を同時に使用できます。

| 項目       | パラメータ／動作                                                           |
| ---------- | -------------------------------------------------------------------------- |
| PULSE      | AMOUNT、SPEED、SYNC。滑らかなタイル拡縮                                    |
| PHOTO WAVE | AMOUNT、WAVELENGTH、SPEED、Horizontal / Vertical / Diagonal / Radial、SYNC |
| FLOAT      | AMOUNT、SPEED、ROTATION、SYNC。タイル固有位相で滑らかに漂う                |
| WIND       | STRENGTH、DIRECTION（度）、TURBULENCE、DRAG、ROTATION、SPEED、SYNC         |
| GUST       | WIND の ON/OFF に関係なく、現在位置から一時的な風力を加え、約3秒で減衰     |
| EXPLOSION  | POWER、ROTATION、CENTER / RANDOM / POINTER                                 |
| ASSEMBLE   | DIRECT / SPRING / SWIRL、FREE（秒）/ 1 / 2 / 4 / 8 beats                   |
| GLITCH     | AMOUNT、SPEED、SYNC。水平スライスとブロック変位                            |
| RGB SHIFT  | AMOUNT、SPEED、SYNC。RGB各チャンネルを分離して移動                         |

周期エフェクトの SYNC は OFF / 1/4 / 1/2 / 1 / 2 / 4 / 8 beats。SYNC OFF の SPEED は Hz です。WIND の SPEED は揺らぎの速度を制御します。DRAG は速度の減衰率で、0 では慣性を維持します。

WIND OFF は写真を戻しません。ASSEMBLE は現在位置と速度から戻り、WIND と GUST を停止します。PULSE / WAVE / FLOAT 等の設定は維持します。途中で GUST / EXPLOSION / WIND ON を操作すると、戻りを中断してその位置から再び動きます。FREEZE 中は完成画面と物理状態を保持します。同期周期エフェクトは解除後の Transport 位相に従います。

既存の「飛散」スライダーも使用できます。「再集合」は同じ ASSEMBLE を呼び、飛散量を物理状態へ移して滑らかに戻します。

POINTER を選ぶと、FX SHORTCUT DECK に選択されたデッキのプレビュークリック位置を爆心地にします。この間はミキサーの境界ドラッグを停止します。CENTER / RANDOM に戻すと境界ドラッグを再開します。

## ショートカット

- E: EXPLOSION
- R: ASSEMBLE
- G: GUST

対象はミキサーの FX SHORTCUT DECK で選択します。デッキのパネルをクリックした場合もそのデッキへ切り替わります。入力欄・セレクト・ボタン・編集可能領域のフォーカス中は無効です。Ctrl / Meta / Alt と組み合わせた E/R/G は横取りしません。

Space / Enter / Shift+Enter / 矢印キーは Phase 1 のままです。

## デモ

Deck A を A ONLY にし、TEXT を「風」にします。写真を読み込み、FLOAT → WAVE → PULSE（SYNC 1 beat）→ GUST → WIND ON → EXPLOSION → ASSEMBLE（SWIRL / 4 beats）の順に操作します。Deck B でも独立して同じ流れを作れます。戻った後で周期エフェクトを OFF にすると元の静止モザイクになります。

## 実装範囲

Canvas2D と既存の共有縮小ビットマップを使用します。MediaPipe、顔加工、手指入力、CRUMPLE / THROW / BOUNCE、音声解析、CUE、タイムライン、録画、AI生成は追加していません。外部ディスプレイの全画面化と実イベント写真による長時間運用は手動確認が必要です。
