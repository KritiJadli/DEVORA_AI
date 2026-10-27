'use client';
import { createContext, useContext } from 'react';

export const ProjectCtx = createContext(null);
/** { project, role, members, reload } */
export const useProject = () => useContext(ProjectCtx);
