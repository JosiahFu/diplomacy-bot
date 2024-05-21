import fs from 'fs'

const file = 'static/state.json';

const seasons = ['Spring', 'Fall'] as const;

export type Season = (typeof seasons)[number]

interface State {
    orders: Record<string, string>,
    turn: [year: number, season: Season],
    lastReveal: string | undefined,
    lastEndTurn: string | undefined,
    lastOrders: Record<string, string>,
}

let defaultState: State = {
    orders: {},
    turn: [1901, 'Spring'],
    lastReveal: undefined,
    lastEndTurn: undefined,
    lastOrders: {}
}

let content;

try {
    content = {...defaultState, ...JSON.parse(fs.readFileSync(file, 'utf-8'))}
} catch {
    content = defaultState;
}

export const STATE: State = content

export function updateStorage() {
    fs.promises.writeFile('static/state.json', JSON.stringify(STATE));
}

export function incrementTurn() {
    const [year, season] = STATE.turn;
    STATE.turn = season == 'Fall' ? [year + 1, 'Spring'] : [year, 'Fall']
}

export function decrementTurn() {
    const [year, season] = STATE.turn;
    STATE.turn = season == 'Fall' ? [year, 'Spring'] : [year - 1, 'Fall']
}

export function resetState() {
    Object.assign(STATE, defaultState);
}
