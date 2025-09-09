// src/ports/i_boomi_service.ts

export interface BoomiCredentials {
    accountId: string;
    username: string;
    password_or_token: string;
}

export interface IBoomiService {
  getComponentDependencies(rootComponentId: string): Promise<string[]>;
}
