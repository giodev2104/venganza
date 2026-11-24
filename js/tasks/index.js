import * as quiz from './quiz.js';
import * as safe from './safe.js';
import * as reveals from './reveals.js';
import * as games from './games.js';
import * as runner from './runner.js';
import * as misc from './misc.js';

/** Registro de tipos de prueba: cada módulo exporta run(root, task, ctx) → Promise<respuesta del servidor>. */
export const REGISTRY = {
  quiz, safe,
  order: { run: safe.runOrder }, pixel: { run: reveals.runPixel }, scratch: { run: reveals.runScratch }, hidden: { run: reveals.runHidden },
  memory: { run: games.runMemory }, jigsaw: { run: games.runJigsaw }, runaway: { run: games.runRunaway }, sequence: { run: games.runSequence },
  runner: { run: runner.runRunner }, troll: { run: misc.runTroll }, media: { run: misc.runMedia },
};
