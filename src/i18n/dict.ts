/** The dictionary's type, split out so pure modules can name it without
 *  importing the i18n index (which pulls in the React Native runtime). */
import type { he } from "./he";
export type Dict = typeof he;
