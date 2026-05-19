import { ProjectExplorer } from '../EIDEProjectExplorer';
import { ProjectInfo } from './protocol';

export function collectProjectRegistry(prjExplorer: ProjectExplorer): ProjectInfo[] {
    const projects: ProjectInfo[] = [];
    prjExplorer.foreachProject((prj) => {
        projects.push({
            uid: prj.getUid(),
            name: prj.getProjectName(),
            rootPath: prj.getProjectRoot().path,
            wsPath: prj.getWsPath()
        });
    });
    return projects;
}

export function normalizePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}
