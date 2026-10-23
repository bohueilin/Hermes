/** The Scale lab registry: one descriptor per lab module. The order is the chooser order and the order of the story:
 * hours at the depot, weeks to months of intake, one day at the support pool. */
import {LAB as responseReserve} from '../model/scale-response.js';
import {LAB as fleetIntake} from '../model/scale-intake.js';
import {LAB as densityLadder} from '../model/scale-density.js';
export const SCALE_LABS=Object.freeze([densityLadder,fleetIntake,responseReserve]);
