import { Participant, ParticipantResult, RoundRobinMode, StageSettings, StageType, Status } from 'brackets-model';
import { ConvertResult, Database, Mapping, toornament } from './types';

/**
 * Converts a Toornament stage type.
 * 
 * @param type Type of the stage.
 */
export function convertStageType(type: toornament.StageType): StageType {
    switch (type) {
        case 'pools':
            return 'round_robin';
        case 'single_elimination':
        case 'double_elimination':
            return type;
        default:
            throw Error('Stage type not supported.');
    }
}

/**
 * Converts Toornament stage settings.
 * 
 * @param settings Settings of the stage.
 */
export function convertStageSettings(settings: toornament.StageSettings): StageSettings {
    return {
        size: settings.size,
        groupCount: settings.nb_groups,
        grandFinal: settings.grand_final,
        skipFirstRound: settings.skip_round1,
        consolationFinal: settings.third_decider,
        roundRobinMode: convertRoundRobinMode(settings.pairing_method),
    };
}

/**
 * Converts a Toornament round-robin mode.
 * 
 * @param method Pairing method.
 */
export function convertRoundRobinMode(method: toornament.PairingMethod): RoundRobinMode | undefined {
    switch (method) {
        case 'standard':
            return 'simple';
        case 'double_standard':
            return 'double';
        default:
            return undefined;
    }
}

/**
 * Converts a Toornament match status.
 * 
 * @param status Status of the match.
 */
export function convertMatchStatus(status: toornament.Status): Status {
    switch (status) {
        case 'pending':
            // Use waiting because it ressembles to the name.
            return Status.Waiting;
        case 'running':
            return Status.Running;
        case 'completed':
            // Use completed because it ressembles to the name.
            return Status.Completed;
    }
}

/**
 * Converts a Toornament participant.
 * 
 * @param id ID of the participant.
 * @param participant Toornament participant.
 */
export function convertParticipant(id: number, participant: toornament.Participant): Participant {
    return {
        id,
        name: participant.name,
        tournament_id: 0,
    };
}

/**
 * Converts a Toornament participant result.
 * 
 * @param id ID of the participant.
 * @param source Source of the participant.
 * @param result Result of the participant.
 */
export function convertParticipantResult(id: number | null, source: number | undefined, result: toornament.Opponent): ParticipantResult {
    return {
        id,
        position: source,
        score: result.score !== null ? result.score : undefined,
        forfeit: result.forfeit || undefined,
        result: result.result || undefined,
    };
}

/**
 * Creates an ID factory, which returns the existing ID or a new incremental ID corresponding to a Toornament ID.
 */
export function idFactory(): {
    (id: string): number,
    getMapping: () => Mapping,
} {
    let currentId = 0;
    const ids: Mapping = {};

    const func = (id: string): number => {
        if (ids[id] === undefined) ids[id] = currentId++;
        return ids[id];
    };

    func.getMapping = (): Mapping => ids;
    return func;
}

/**
 * Converts Toornament data to brackets-viewer data.
 * 
 * @param data Data coming from Toornament put in a single object.
 * @param data.tournament_id ID of the tournament.
 * @param data.stages List of stages.
 * @param data.matches List of matches.
 */
export function convertData(data: {
    tournament_id: number,
    stages: toornament.Stage[];
    matches: toornament.Match[];
}): ConvertResult {
    const db: Database = {
        stage: [],
        match: [],
        match_game: [],
        participant: [],
    };

    const stageId = idFactory();

    for (const stage of data.stages) {
        db.stage.push({
            id: stageId(stage.id),
            tournament_id: 0,
            name: stage.name,
            type: convertStageType(stage.type),
            number: stage.number,
            settings: convertStageSettings(stage.settings),
        });
    }

    const participants: { [id: string]: Participant } = {};

    const participantId = idFactory();
    const matchId = idFactory();
    const groupId = idFactory();
    const roundId = idFactory();

    /**
     * Finds the source position of a participant based on the the source match number.
     * 
     * @param result Result of the participant.
     */
    function findSourcePosition(result: toornament.Opponent): number | undefined {
        if (!result.source_node_id)
            return undefined;

        const sourceMatchId = result.source_node_id;
        const sourceMatch = db.match.find(match => match.id === matchId(sourceMatchId));
        if (!sourceMatch) throw Error('Source match not found.');
        return sourceMatch.number;
    }

    for (const match of data.matches) {
        // Skip matches without opponents
        if (!match.opponents) continue;

        const [id1, id2] = match.opponents.map(opponent => opponent.participant?.id !== undefined ? participantId(opponent.participant.id) : null);

        if (id1 !== null && match.opponents[0].participant) {
            const opponent1 = convertParticipant(id1, match.opponents[0].participant);

            if (!participants[opponent1.id.toString()])
                participants[opponent1.id.toString()] = opponent1;
        }

        if (id2 !== null && match.opponents[1].participant) {
            const opponent2 = convertParticipant(id2, match.opponents[1].participant);

            if (!participants[opponent2.id.toString()])
                participants[opponent2.id.toString()] = opponent2;
        }

        db.match.push({
            id: matchId(match.id),
            stage_id: stageId(match.stage_id),
            group_id: groupId(match.group_id),
            round_id: roundId(match.round_id),
            number: match.number,
            child_count: 0,
            status: convertMatchStatus(match.status),
            opponent1: convertParticipantResult(id1, findSourcePosition(match.opponents[0]), match.opponents[0]),
            opponent2: convertParticipantResult(id2, findSourcePosition(match.opponents[1]), match.opponents[1]),
            metadata: {
                original_match_id: match.id,
            },
        });
    }

    Object.values(participants).forEach(participant => db.participant.push(participant));

    return {
        database: db,
        mappings: {
            tournament: { [data.tournament_id]: 0 },
            stages: stageId.getMapping(),
            groups: groupId.getMapping(),
            rounds: roundId.getMapping(),
            matches: matchId.getMapping(),
            participants: participantId.getMapping(),
        },
    };
}
