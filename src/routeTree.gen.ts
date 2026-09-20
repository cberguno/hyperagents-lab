/* eslint-disable */
// Generated-style route tree for HyperAgents Lab.

import { Route as rootRoute } from "./routes/__root";
import { Route as IndexRouteImport } from "./routes/index";
import { Route as ApiMetaAgentRouteImport } from "./routes/api/meta-agent";

const IndexRoute = IndexRouteImport.update({
  id: "/",
  path: "/",
  getParentRoute: () => rootRoute,
} as any);

const ApiMetaAgentRoute = ApiMetaAgentRouteImport.update({
  id: "/api/meta-agent",
  path: "/api/meta-agent",
  getParentRoute: () => rootRoute,
} as any);

export interface FileRoutesByFullPath {
  "/": typeof IndexRoute;
  "/api/meta-agent": typeof ApiMetaAgentRoute;
}

export interface FileRoutesByTo {
  "/": typeof IndexRoute;
  "/api/meta-agent": typeof ApiMetaAgentRoute;
}

export interface FileRoutesById {
  __root__: typeof rootRoute;
  "/": typeof IndexRoute;
  "/api/meta-agent": typeof ApiMetaAgentRoute;
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath;
  fullPaths: "/" | "/api/meta-agent";
  fileRoutesByTo: FileRoutesByTo;
  to: "/" | "/api/meta-agent";
  id: "__root__" | "/" | "/api/meta-agent";
  fileRoutesById: FileRoutesById;
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute;
  ApiMetaAgentRoute: typeof ApiMetaAgentRoute;
}

declare module "@tanstack/react-router" {
  interface FileRoutesByPath {
    "/": {
      id: "/";
      path: "/";
      fullPath: "/";
      preLoaderRoute: typeof IndexRouteImport;
      parentRoute: typeof rootRoute;
    };
    "/api/meta-agent": {
      id: "/api/meta-agent";
      path: "/api/meta-agent";
      fullPath: "/api/meta-agent";
      preLoaderRoute: typeof ApiMetaAgentRouteImport;
      parentRoute: typeof rootRoute;
    };
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute,
  ApiMetaAgentRoute,
};

export const routeTree = rootRoute._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>();
