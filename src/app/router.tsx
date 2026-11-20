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
import { AdministrationPage } from '../pages/AdministrationPage'
import { SuiteAuth } from '../features/auth/SuiteAuth'

const rootRoute = createRootRoute({
  component: () => (
    <SuiteAuth>
      <AppShell />
    </SuiteAuth>
  ),
})
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdministrationPage,
})
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
  basepath: import.meta.env.VITE_SERVICE_BASEPATH || '/',
  routeTree: rootRoute.addChildren([
    homeRoute,
    servicesRoute,
    newServiceRoute,
    serviceEditorRoute,
    ...(import.meta.env.DEV ? [contractRoute] : []),
    publicPreviewRoute,
    adminRoute,
  ]),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
