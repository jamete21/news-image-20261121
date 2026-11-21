# The World in One Picture — Saturday 21 November 2026

[![make.fun · news-image-20261121](https://make.fun/badge/news-image-20261121.svg)](https://make.fun/bounty/news-image-20261121?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261121)
[![rank](https://make.fun/badge/news-image-20261121/jamete21/news-image-20261121/rank.svg)](https://make.fun/bounty/news-image-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261121)
[![reward](https://make.fun/badge/news-image-20261121/jamete21/news-image-20261121/reward.svg)](https://make.fun/bounty/news-image-20261121?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261121)

A newspaper front page that sums up Saturday 21 November 2026, drawn entirely in code.

## What it shows

- **Lead — Russia's biggest strikes on Ukraine:** 400+ drones and 110 missiles overnight, at least 8 killed in Kyiv; a Russian missile comes down in south-east Poland as NATO jets scramble.
- **The Hague — Myanmar guilty of genocide:** the UN court rules 9-6, the first state ever held responsible for genocide against the Rohingya.
- **New York — Wall Street slides into correction:** S&P 500 -3.7%, Nasdaq -5.3%, Dow -1.9%; the Nasdaq wipes out all its 2026 gains.
- **Brussels — UK and EU seal post-Brexit deals:** food checks scrapped from March 2028, carbon markets linked from January 2028, youth travel for 100,000.
- **Riyadh — Saudis down Houthi missiles:** three aimed at the capital, the third night running.
- **Antalya — COP31 talks stall:** the deadline passes and the draft drops any mention of fossil fuels.
- **Lima — 6.8 quake shakes Peru:** Junin region; tremors felt in Lima, 320 km away.

Plus a ticker: Trump calls Putin "a friend" (Zelensky: "a killer"), GTA VI banks $3.8bn on day one, and KL Rahul completes the SENA century set.

## How it is made

`main.ts` (Node 22, standard library only, no network) draws the whole front page with a hand-defined 5x7 bitmap font, its own raster helpers, and a from-scratch PNG encoder, then writes `/output/entry.png` — 1024x1024, deterministic: two runs write identical bytes.

Verified output: `entry.png`, 24,675 bytes, sha256 `4347a35282047def314102d721a0c6b69bf86dafe0c103aa3e94e4602d1cb9e4` (identical across two runs).

Run it locally:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Licence

MIT — see [LICENSE](LICENSE).

---

Built for the [make.fun](https://make.fun/?ref=18vvq4qr) bounty [news-image-20261121](https://make.fun/bounty/news-image-20261121).
