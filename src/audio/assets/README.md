# Voice samples

Copied unchanged from the game sound pack supplied by the user in `docs/Lemmings-sounds.zip`.
Playback uses the original pitch and timing, with gain reduced to match the game's effects.

| File | Trigger |
| --- | --- |
| LETSGO1.wav | First lemming released |
| YIPPEE1.wav | Lemming enters the goal |
| CLIMBER2.wav | Successful Climber assignment |
| FLOATER1.wav | Successful Floater assignment |
| BOMBER.wav | Successful Bomber assignment |
| BLOCKER1.wav | Successful Blocker assignment |
| BASHER2.wav | Successful Basher assignment |
| MINER2.wav | Successful Miner assignment |
| CHEERS1.wav | Level won |
| BOOS.wav | Level lost |
| DROWN1.wav | Swimmer starts drowning after exhausting its endurance |
| FALLER3.wav | Fatal landing or falling out of the map |
| OHNO1.wav | Bomber fuse enters its final second |
| GEDDON1.wav | Nuke confirmed (stops the previous voice first) |
| UH_UH1.wav | Skill click hits a lemming that cannot accept it |
| PLAY.wav | Start, restart, next level, or editor playtest |
| OPTIONS.wav | Open the guide, level select, editor, or export/import panel |
| EXIT.wav | Close a menu or guide |
| HUP3.wav | Tool selection, rate adjustment, pause, fast-forward, grid, guide navigation, and editor buttons |

Gameplay voices use a gain of 0.5. Menu cues use 0.3 and button feedback uses 0.16.
UI samples occupy one separate lane; a new UI cue replaces the preceding UI sample.
Rapid clicks are throttled. UI feedback never blocks a gameplay voice.
All samples load concurrently after audio is enabled by a gesture. UI cues have a short
synthesized fallback while unavailable; no late sample is replayed. Gameplay effects
and voices are cancelled by pause, menus, restart, mute, tab hiding, or window blur;
the menu/control action may then play its own UI cue. Result voices may follow a
currently playing gameplay voice, and cancellation stops scheduled results too.
