import { GrandFinalType, Match as BaseMatch, MatchGame, Participant, Result, Stage } from 'brackets-model';

// Extend the Match interface to include metadata
export interface Match extends BaseMatch {
    metadata?: {
        original_match_id: string;
        [key: string]: any;
    };
}

export interface ConvertResult {
    database: Database,
    mappings: Record<string, Mapping>,
}

export interface Database {
    stage: Stage[],
    match: Match[],
    match_game: MatchGame[],
    participant: Participant[],
}

export type Mapping = { [id: string]: number };

export namespace toornament {

    export type PairingMethod = 'manual' | 'standard' | 'double_standard';
    export type StageType = 'single_elimination' | 'double_elimination' | 'pools';
    export type Status = 'pending' | 'running' | 'completed';

    export interface StageSettings {
        size: number;
        nb_groups: number;
        pairing_method: PairingMethod;
        grand_final: GrandFinalType;
        third_decider?: boolean;
        skip_round1?: boolean;
    }

    export interface Stage {
        id: string;
        number: number;
        name: string;
        type: StageType;
        settings: StageSettings;
    }

    export interface Participant {
        id: string;
        name: string;
    }

    export interface Opponent {
        number: number;
        position: number;
        participant: Participant | null;
        result: Result | null;
        forfeit: boolean;
        score?: number | null;
        source_node_id?: string | null;
    }

    export interface Match {
        id: string;
        stage_id: string;
        group_id: string;
        round_id: string;
        number: number;
        type: string;
        status: Status;
        opponents: Opponent[];
    }
}
