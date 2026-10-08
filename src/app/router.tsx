import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { AppShell } from './shell'
import { HomePage } from '../pages/HomePage'
import { ServicesPage } from '../pages/ServicesPage'
import { NewServicePage } from '../pages/NewServicePage'
import { ServiceEditorPage } from '../pages/ServiceEditorPage'
import { ContractInspectorPage } from '../pages/ContractInspectorPage'
import { PublicPreviewPage } from '../pages/PublicPreviewPage'

const rootRoute = createRootRoute({ component: AppShell })
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})
const servicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/services',
  component: ServicesPage,
})
const newServiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/services/new',
  component: NewServicePage,
})
const serviceEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/services/$serviceId',
  component: ServiceEditorPage,
})
const contractRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/development/contract',
  component: ContractInspectorPage,
})
const publicPreviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/public-preview',
  component: PublicPreviewPage,
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    homeRoute,
    servicesRoute,
    newServiceRoute,
    serviceEditorRoute,
    contractRoute,
    publicPreviewRoute,
  ]),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
