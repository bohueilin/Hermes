# SF power study — frozen source and protocol checkpoint

Recorded 2026-09-30T00:53:34.781440+00:00 before any SF preflight or evaluation execution.

This is a local digest-bound source inventory checkpoint. No source commit or independent timestamp/authenticity is claimed. The approved proposal allows a truthful source commit **or inventory**; the existing City source overlay is untracked and the notebook is being edited independently. No generated run data is staged.

- Protocol: `181da257329efec546b5df88d6b0ad7a666c0194b18e327546f82ea1961025fd`.
- Study: `sf-power-headroom-v1`.
- Frozen directory: `build/fleetlab-city/studies/sf-power-headroom-v1/`.
- Historical spec: `64f1be6c7442e988c619a97b687c85bac5f259519a62142c894a0d4dbf23c56e`.
- Pack manifest: `5c604fa0c0af9355dd6851ec5f6f7cac16a00b3c296c08de318f468ac1d7e536`.
- Model: `fleetlab.graph-resource/1.0.0`.
- Original 34 arms reproduced exactly; all scientific/input digests match and aggregate comparison is byte-identical.
- Independent Task 1 review: approved after nested protocol-only seed collision handling was fixed; 18 focused / 104 City tests passed.
- Simulator, routing, input generator, verifier, runner and existing comparator remain unchanged.

## Declared experiment

Six configurations: A, A+B and B at 200 and 400 kW total. Every configuration has eight 50 kW ports and four turnaround slots. All other frozen controls remain fixed: 100 EVs, 1,200 requests, 30 kWh initial energy, 48 kWh target, 07:00–15:00, original 220-node pool and depot nodes.

Preflight seeds 7301001–7301004; evaluation seeds 7302001–7302024. One full tape is shared across all six configurations of each seed. All 28 tapes exist before any execution. Duplicate/reused seeds and repeat execution are refused.

Primary: (AB400−A400)−(AB200−A200), seed-paired completion percentage points; 95% Student-t interval; fixed ±1 pp practical band. B-only is secondary. No optional stopping, cell substitution or seed replacement. Invalid or missing evidence makes the primary unavailable. Only all-six-configurations replay for first evaluation seed 7302001 is planned for the browser.

Resource ceiling: 4 GB process peak, 2 GB estimated routing tables; crossing stops before further arms and leaves an incomplete result. These are measured/checked limits, not an OS memory reservation.

Map eligibility remains `BLOCKED_MAP_QUALIFICATION`; scope `SIMULATION_ONLY`; decision authority `NONE`. The fixed experiment cannot qualify the map or establish road safety.

## Scientific implementation identities

| File in citylib | SHA-256 |
|---|---|
| `contracts.py` | `4bcac3ad27668ffd80e92eb0265e4cc97942249b7c9d1fa55b7e188105dab739` |
| `engine.py` | `5ecab7bd80465c6c298b8bc2292e9e1b9b0f677c23c4b3a5553771ac67fdf733` |
| `inputs.py` | `0ed8648f4f9d1084ebb796f1bf8f5584d7abd980ddff651e6e6d953190d3d93d` |
| `ledger.py` | `0fe37a3c52b644d2bbe50e9cb5da98870ea34acab1a5dfc47cd8f54936467b94` |
| `pack.py` | `10ca20a075d3098814aa2a60358a55816756fd2a3953cb140779271041fd150a` |
| `power_analysis.py` | `c0249184cf0bd543c904d76519ac6e343ce92d69c2f52f4d2ecb85b7adee9379` |
| `power_protocol.py` | `880780336335cedab1a1cbb48ac6367c2125ff78d266eeb14fa9c2ec530dd815` |
| `power_study.py` | `10e5aa5a27266982ec372d45672695458efcef68017192d8a8b25e83ce719091` |
| `restrictions.py` | `1bf960f9b05fd946e3117bc5aa9c1be7b67ccdf669b21abf3fbdd0070b6fa229` |
| `routing.py` | `644a9298c46a439fa59fc48c65f0edc61e07ec6ce433e303c63fedef3968370a` |
| `runner.py` | `e6d8147c9eaf1d38cd5927c184c4bf849943179c0aa5b2d90711ca90b413f019` |
| `verify.py` | `2e2b26ee0c2bcc5474d382efd3f9ef21759606971a59badd3e0bd1b1836b045f` |

## Frozen input identities

| Seed | Canonical input digest |
|---|---|
| 7301001 | `3bdf25dffb927d2e2f5b1721ab80b0a97d89f961cedaea3dae3bcdbc73352757` |
| 7301002 | `f00e0b1cc04cf4b0ca2631d6f06403836a1f937042ab7b57a16d639190868e46` |
| 7301003 | `aa9c494bc2ba94094943d31e029d4a924a4cba66bb22fcb12b4c12adb7d711b7` |
| 7301004 | `d7df5175394e6661dee72c4d4170e6a9825108e21fd6e9f7809268a02f79ad46` |
| 7302001 | `5a38f5bab5de276f5b6a3b4b58007b7e22cd877133f7f94e1ae6a32e39997682` |
| 7302002 | `fbcaa0b17267533dc72a43894951c2bd4cf35d7927f59d3bc921c5f663360b9e` |
| 7302003 | `526f9100f7eb5b87e12705fd0d7d0927de1b16db7ffccfeafff2bde0ae2bbecc` |
| 7302004 | `66fbac7fee9fcff8cd10c803828533779bb133520a0e41255b021ab1cb1e63ea` |
| 7302005 | `9c165886e2f67b65504be011eac89e8df5b38a24160e50a0b2d292f20aa0c006` |
| 7302006 | `d416e285d886f4ddb9b19ab26566784c8f645be058769e67c4b077953c093b4a` |
| 7302007 | `0de58449cefb1f657f2432625523a5b9109d8bc0744d0b28c71c2de182ce97ab` |
| 7302008 | `99a13b89b183b27043f8d011cefc4fd6fc7737d85662dc4c0708e0b22b967073` |
| 7302009 | `8449fcf8e6e1cab56f2b35b83f6b9d2f3f717c73b02223a758e0ca7b3243abff` |
| 7302010 | `c7f7dc948bb09cdc6fb758353a6fff353da40ff546b7d7f4883dc15ace0dbe9e` |
| 7302011 | `7d5610132da27c59df9430fb091b0bb3cbfe4a9c3d09ce626aa044cda54d7d04` |
| 7302012 | `66b346c46d54f85afb65bca49dd2990ab8c32492d4fcc3b12d51ee5b54da81a9` |
| 7302013 | `20e1cbcba98ba96d621021fe91371ad17ec9db7e7a3d01117606534ba3b26754` |
| 7302014 | `87884cfd42d78434a34d1d6d3d9e90cd8c1b9d8a61b779323bb03ff372652cb7` |
| 7302015 | `8bdcc1d0487c5b0a244f19c59640f7865fc3ddd61e3eeb56e33196ba935736ad` |
| 7302016 | `65398516e88a3789827a4f3f7c3f75458588cb3be4bf8f4ea3be0647571f287a` |
| 7302017 | `414c63d58a468033e366373e1b76354e79dbf72b345b36edced1c4b80c644339` |
| 7302018 | `b62e822f8b1213594b3a0745a23d7fa562c43325376e522daab86d13b61d6ae3` |
| 7302019 | `59afb1f085c7f6e77ea8d32286122b4db389426ad0fcfa7a352daea5f7630b0e` |
| 7302020 | `968a79b997dec0428100baab27c1a3ea462eb9ce2a5a716fa0068edd3c5c22bd` |
| 7302021 | `626626618f500d11167d5dff9bb314a7f1729384ce1ce81d1f57a7f4699f40ef` |
| 7302022 | `8e53232967da331a5d4445bfbb95204b24d20c57fcffb15bb3b947add12d20a1` |
| 7302023 | `eab526dd5f4c91b4415ed2e2e4b219ed78de7cc50a5dd38a051894dbe1c949d9` |
| 7302024 | `f7f4613026fdb1640e078ba262f00f09d880170b2520dec6c12e4a2c1fa0f259` |

## Review and limits

Review reports, focused test logs, reproduction result and full source snapshot are retained under `.superpowers/sdd/2026-09-29-sf-power-and-integration/` and `build/fleetlab-city/validation/power-v1/`. Historical v1 graph, cross-stop continuity limitations, artificial demand/depots and incomplete semantic map review remain in force. UI work may not change any frozen scientific source identity.
