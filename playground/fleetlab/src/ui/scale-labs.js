/** The Scale lab registry: one descriptor per lab module. The order is the chooser order. */
import {LAB as responseReserve} from '../model/scale-response.js';
import {LAB as fleetIntake} from '../model/scale-intake.js';
import {LAB as densityLadder} from '../model/scale-density.js';
export const SCALE_LABS=Object.freeze([responseReserve,fleetIntake,densityLadder]);
