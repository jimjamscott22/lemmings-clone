import { BOMB_FUSE, BOMB_RADIUS, NUKE_CONFIRM_TIME, SPLAT_HEIGHT, SWIM_ENDURANCE, TILE_SIZE } from "../config";
import { byId } from "./Hud";

/** A native modal keeps focus and pointer input in the guide, away from the game underneath. */
export class HelpGuide {
  private readonly root = byId<HTMLDialogElement>("help");

  constructor(private readonly onClose: () => void) {
    byId("help-content").innerHTML = guideContent();
    this.root.querySelectorAll<HTMLAnchorElement>(".help-nav a").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const section = byId(link.hash.slice(1));
        section.scrollIntoView({ block: "start" });
        byId("help-content").focus({ preventScroll: true });
      });
    });
    byId("help-close").addEventListener("click", () => this.close());
    this.root.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.close();
    });
    this.root.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const controls = [...this.root.querySelectorAll<HTMLElement>("button, a[href], [tabindex='0']")];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });
  }

  get isOpen(): boolean {
    return this.root.open;
  }

  open(): void {
    if (this.isOpen) return;
    this.root.showModal();
    byId("help-content").scrollTop = 0;
    byId("help-close").focus();
  }

  close(): void {
    if (!this.isOpen) return;
    // Clear only input from the guide, before focus returns and fresh game keys can arrive.
    this.onClose();
    this.root.close();
  }
}

function guideContent(): string {
  return `
    <section id="guide-start" aria-labelledby="guide-start-title">
      <h3 id="guide-start-title">Your first rescue</h3>
      <p>Lemmings drop from the hatch and move on their own. You shape their route and give individual lemmings skills so enough reach the green goal. You do not steer them directly.</p>
      <ol>
        <li><strong>Read the target.</strong> The level card tells you how many to save. In the HUD, <strong>Saved</strong> shows rescues / required rescues; <strong>Out</strong> is the number currently in play, and <strong>Lost</strong> counts deaths.</li>
        <li><strong>Pause and inspect.</strong> Press <kbd>Space</kbd>. Find the hatch, goal, water, tall drops, and walls. You can edit terrain, assign skills, and change the release rate while paused.</li>
        <li><strong>Make a safe route.</strong> Select a terrain tool and drag across tiles, or select a skill and click one lemming. A green outline identifies a lemming that can take the selected skill.</li>
        <li><strong>Resume and watch the first lemming.</strong> Slow the release rate while preparing the route. Speed it up once the path is safe, and use <kbd>F</kbd> for ×3 fast-forward.</li>
      </ol>
      <p>The level finishes when every lemming is saved or lost, or its time limit expires. Meeting the target wins; you do not need to save everyone. Levels 1–3 are untimed. Later levels have a countdown shown on the level card and beside <strong>Time</strong> in the HUD. At zero, anyone who has not reached the exit counts as lost; meeting the save target still wins. Lemmings already in their exit animation count as saved. Pause, the guide, level select, and the editor freeze the countdown; ×3 fast-forward speeds it up. Restart resets it.</p>
    </section>

    <section id="guide-behavior" aria-labelledby="guide-behavior-title">
      <h3 id="guide-behavior-title">What lemmings do automatically</h3>
      <p>Every lemming starts facing right. It walks until the terrain changes its behavior. These are automatic actions, not extra skills you select:</p>
      <dl>
        <dt>Walk, fall, and turn</dt><dd>Walkers leave ledges without checking the drop. They turn around at obstacles they cannot handle and at the side edges of the map.</dd>
        <dt>Jump a step</dt><dd>A one-tile obstacle with clear headroom triggers a jump. A Climber still tries this small jump before climbing.</dd>
        <dt>Dig through dirt</dt><dd>When a taller dirt obstacle blocks a walker, it digs through the tile ahead automatically. A Climber climbs instead. This uses neither your Dig tool charges nor a Basher charge.</dd>
        <dt>Build with personal bricks</dt><dd>If jumping, climbing, and digging do not apply, a lemming with bricks may place a bridge block under itself to rise past a tall obstacle. Each block uses one of that lemming's bricks. Bricks are set by the level, separate from the global Build tool budget. The blocks stay behind for others.</dd>
        <dt>Swim briefly</dt><dd>A lemming entering water paddles at the surface for about ${SWIM_ENDURANCE} seconds. It can climb onto a low bank with clear space above it; a tall bank makes it turn around. If it cannot get out in time, it sinks and drowns.</dd>
        <dt>Exit</dt><dd>Touching a goal starts the exit animation and saves the lemming. It no longer needs a job.</dd>
      </dl>
    </section>

    <section id="guide-tools" aria-labelledby="guide-tools-title">
      <h3 id="guide-tools-title">Terrain tools: change the map</h3>
      <p>Click a toolbar button or press its number, then click or drag over tiles. The number beside each tool is its remaining level-wide budget. Each successful tile edit spends one charge; invalid tiles spend nothing.</p>
      <div class="guide-cards">
        <article><h4><kbd>1</kbd> Dig</h4><p>Removes dirt and bridge tiles. Use it to open a passage, cut steps down a slope, or remove support under a Blocker.</p><p><strong>Watch out:</strong> it cannot remove walls, steel, one-way walls, hazards, the goal, or the hatch. Removing a floor can send the crowd into a fatal drop.</p></article>
        <article><h4><kbd>2</kbd> Build</h4><p>Places bridge tiles in empty air. Drag a walkway across a gap or above water, or make one-tile steps to a higher platform.</p><p><strong>Watch out:</strong> it cannot replace existing tiles or plug the hatch. Leave room for lemmings' bodies: burying them deeply in new blocks can crush them.</p></article>
      </div>
      <p>These tools act immediately wherever you edit the map. They do not assign a Digger or Builder job to a lemming.</p>
    </section>

    <section id="guide-skills" aria-labelledby="guide-skills-title">
      <h3 id="guide-skills-title">Skills: give one lemming a role</h3>
      <p>Select <kbd>3</kbd>–<kbd>8</kbd> or click the skill's toolbar button, then click a lemming. Each successful assignment spends one charge. If the target is not outlined green, it cannot take that skill or you have no charges left.</p>
      <p><strong>Upgrades and jobs work differently.</strong> Climber and Floater are permanent upgrades and can be combined on the same lemming. Bomber adds a fuse while the lemming continues its current activity. These three can be given to any lemming still in play except one already exiting or splatting; you cannot give the same upgrade or fuse twice.</p>
      <p>Blocker, Basher, and Miner replace the current job. Assign them while the lemming is walking, automatically digging or building, bashing, or mining. They cannot be assigned during a fall, jump, climb, swim, exit, or splat, or to a standing Blocker. Reassigning the same current job is not allowed.</p>
      <div class="guide-cards">
        <article><h4><kbd>3</kbd> Climber <span>Permanent upgrade</span></h4>
          <p><strong>What it does:</strong> climbs wall faces that would otherwise block it, then walks onto the top. An overhang makes it turn and let go.</p>
          <p><strong>Use it:</strong> send one lemming over a tall barrier to reach a new area or prepare a route. Give it Floater too if the far side has a high drop.</p>
          <p><strong>Watch out:</strong> only the chosen lemming gains this ability; it makes no path for the crowd. It may climb out of a holding area you intended to keep closed.</p></article>
        <article><h4><kbd>4</kbd> Floater <span>Permanent upgrade</span></h4>
          <p><strong>What it does:</strong> opens an umbrella after falling one tile and drifts down safely, surviving any landing height.</p>
          <p><strong>Use it:</strong> protect a scout taking a long drop, or pause and assign it to a falling lemming before it lands.</p>
          <p><strong>Watch out:</strong> it protects only against fall damage. It does not prevent drowning, explosions, crushing, or falling out of the bottom of the map.</p></article>
        <article><h4><kbd>5</kbd> Bomber <span>One-use fuse</span></h4>
          <p><strong>What it does:</strong> counts down ${BOMB_FUSE} simulation seconds, then kills that lemming and removes dirt and bridge whose tile centers are within ${BOMB_RADIUS / TILE_SIZE} tiles of the blast. Walls, steel, and one-way walls remain intact.</p>
          <p><strong>Use it:</strong> remove a Blocker or blast an opening in nearby dirt or bridge. A moving Bomber keeps moving, so plan where it will be when the fuse runs out.</p>
          <p><strong>Watch out:</strong> there is no cancel button. Reaching the goal in time defuses it and saves it. The blast removes terrain rather than directly killing nearby lemmings, but losing their floor can still be deadly. Pausing freezes the fuse; fast-forward speeds it up.</p></article>
        <article><h4><kbd>6</kbd> Blocker <span>Stationary job</span></h4>
          <p><strong>What it does:</strong> stands still and turns approaching walkers around. It blocks from either side.</p>
          <p><strong>Use it:</strong> hold the crowd back from a ledge while you prepare a bridge or tunnel, or turn walkers toward the goal.</p>
          <p><strong>Watch out:</strong> you cannot simply assign another job to free it. Dig away its support so it falls and resumes moving, or give it Bomber to remove it. Plan a safe landing if you want to rescue it. Once everyone is released and only stranded Blockers remain, they count as lost.</p></article>
        <article><h4><kbd>7</kbd> Basher <span>Horizontal tunnel</span></h4>
          <p><strong>What it does:</strong> tunnels forward through dirt and bridge at body height, including one-tile steps a normal walker would jump. It can walk toward terrain before beginning to cut.</p>
          <p><strong>Use it:</strong> choose a lemming facing the desired direction to open a level passage through an obstacle. The crowd can follow through the opening.</p>
          <p><strong>Watch out:</strong> it stops bashing when a cut breaks through or it meets undiggable terrain, and falls if it loses support. It cannot tunnel through walls, and automatic walking behavior resumes afterward.</p></article>
        <article><h4><kbd>8</kbd> Miner <span>Diagonal descent</span></h4>
          <p><strong>What it does:</strong> clears the tile ahead and the one below it, then steps one tile down and forward to cut a descending staircase.</p>
          <p><strong>Use it:</strong> start on top of a dirt mass, facing the intended route, to make a gradual way down for the crowd.</p>
          <p><strong>Watch out:</strong> a wall in either cutting position stops the job. Breaking out into open air makes the Miner fall. Check the landing and any water below before digging.</p></article>
      </div>
    </section>

    <section id="guide-hazards" aria-labelledby="guide-hazards-title">
      <h3 id="guide-hazards-title">Hazards and useful combinations</h3>
      <ul>
        <li><strong>Long falls:</strong> a fall greater than ${SPLAT_HEIGHT / TILE_SIZE} tiles onto solid ground is fatal without Floater. Build intermediate landings or protect the individual lemming.</li>
        <li><strong>Water:</strong> swimming is a short escape window, not a safe way across a wide pool. Bridge over it or provide a nearby low bank.</li>
        <li><strong>Walls:</strong> these are solid and indestructible. Dig, Basher, Miner, and Bomber cannot remove them. Go over or around them.</li>
        <li><strong>Steel:</strong> dirt-like tiles with metallic flecks are indestructible too. Lemmings can stand on or climb them, but no digging job, terrain tool, or explosion can remove them.</li>
        <li><strong>One-way walls:</strong> arrows show the permitted cutting direction. A Basher or Miner facing that direction can tunnel through; facing the opposite way stops the job. Automatic digging, the Dig tool, and explosions cannot remove them.</li>
        <li><strong>Lava and spikes:</strong> contact kills instantly, without a swimming escape window. Floater does not protect against them. Build above them or find another route; you cannot dig them away or build directly into them.</li>
        <li><strong>The void and crushing:</strong> falling below the map loses a lemming, even a Floater. Avoid enclosing lemmings in stacks of bridge blocks.</li>
      </ul>
      <p><strong>Hold, build, release:</strong> place a Blocker before a dangerous ledge, pause, build a walkway, then remove the Blocker's support only if there is safe ground below it. Do this before only Blockers remain.</p>
      <p><strong>Scout, then guide:</strong> combine Climber and Floater on a scout to explore a tall obstacle safely. Use terrain tools, a Basher, or a Miner to create a route the ordinary crowd can follow.</p>
      <p><strong>Manage the crowd:</strong> lower the release rate to separate lemmings for precise skill clicks. A higher rate releases them faster; it does not change their walking speed. The range is 1–99, and holding − or + changes it quickly.</p>
    </section>

    <section id="guide-controls" aria-labelledby="guide-controls-title">
      <h3 id="guide-controls-title">Controls and ending a run</h3>
      <dl class="guide-controls">
        <dt><kbd>1</kbd> / <kbd>2</kbd></dt><dd>Select Dig / Build, then click or drag terrain.</dd>
        <dt><kbd>3</kbd>–<kbd>8</kbd></dt><dd>Select Climber, Floater, Bomber, Blocker, Basher, or Miner, then click a lemming.</dd>
        <dt><kbd>Space</kbd></dt><dd>Toggle pause. Terrain edits and assignments still work.</dd>
        <dt><kbd>−</kbd> / <kbd>+</kbd></dt><dd>Adjust release rate; the HUD buttons work too.</dd>
        <dt><kbd>F</kbd></dt><dd>Toggle ×3 fast-forward. Movement, swimming endurance, and bomb fuses all run faster.</dd>
        <dt><kbd>R</kbd></dt><dd>Restart the current level with fresh terrain and budgets.</dd>
        <dt><kbd>N</kbd></dt><dd>Advance after winning a built-in level.</dd>
        <dt><kbd>G</kbd></dt><dd>Toggle the tile grid to plan edits and count drops.</dd>
        <dt><kbd>L</kbd></dt><dd>Open level select; Esc or L closes it.</dd>
        <dt><kbd>E</kbd></dt><dd>Open or leave the level editor.</dd>
        <dt><kbd>H</kbd></dt><dd>Open this guide from the game, level select, or editor. Esc or Close returns you to the same screen and pause state.</dd>
        <dt><kbd>K</kbd> twice</dt><dd>Confirm Nuke within ${NUKE_CONFIRM_TIME} seconds. Unreleased lemmings count as lost and all active lemmings get a ${BOMB_FUSE}-second fuse. Existing fuses are not reset; lemmings reaching the goal in time are still saved. Nuke cannot be undone; use R to restart.</dd>
      </dl>
      <p>The simulation is frozen while this guide or level select is open. Game shortcuts and terrain input are disabled in the guide so you can read safely.</p>
      <p><strong>Sound on / off:</strong> the top-bar button mutes or enables all effects and remembers your choice in this browser. Sound starts after your first click or key press. Listen for the hatch opening, crunchy digging, splashes, and a high-pitched “Yippie!” at the goal. The spoken voice depends on your browser; when an English speech voice is unavailable, a cheerful two-note chirp plays instead. Crowded rescues and rapid digging are limited to keep sounds from piling up. Pausing, opening a menu or the editor, and restarting stop active sounds; they are not replayed when you resume.</p>
    </section>

    <section id="guide-extras" aria-labelledby="guide-extras-title">
      <h3 id="guide-extras-title">Progress, editor, and sharing</h3>
      <p>Built-in levels unlock in order. Winning unlocks the next level; cards show your best saved count, fastest win, and completed attempts. Progress, the last played level, and your grid and sound preferences are saved in this browser. Reset progress on level select clears those records and preferences and locks all but the first level.</p>
      <p>Press <kbd>E</kbd> or click Editor to create a level. The current game is frozen while editing. Choose brushes with <kbd>1</kbd>–<kbd>7</kbd>: Empty, Dirt, Water, Wall, Bridge, Goal, and Hatch. Extra brushes use <kbd>8</kbd> for Steel, <kbd>9</kbd> for One-way ←, <kbd>0</kbd> for One-way →, <kbd>Q</kbd> for Lava, and <kbd>W</kbd> for Spikes. You can also click any brush. Use <kbd>B</kbd> for the drag pencil or <kbd>F</kbd> for flood fill, and <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Z</kbd> / <kbd>Y</kbd> for undo / redo.</p>
      <p>The editor lets you set the map size, name, lemming count, save target, time limit in seconds (0 means untimed), release rate, personal bricks, and each tool or skill budget. A playable level needs a name, hatch, goal, and a valid save target; the editor lists any problems.</p>
      <p>Press <kbd>P</kbd> to playtest a valid draft. Playtesting replaces the active attempt, but never records built-in progress. Use <kbd>E</kbd> or <kbd>Esc</kbd> to return to the editor. Your draft is saved automatically in this browser.</p>
      <p>Share copies a link containing the whole custom level. Someone opening it can play immediately without affecting built-in progress. On its result screen, Edit a copy loads it into the editor after confirming replacement of the current draft. Export / import can also copy or load level text and share links.</p>
    </section>`;
}
