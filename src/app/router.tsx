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
import { ContentPage } from '../pages/ContentPage'
import { SuiteAuth, GlobalAdministration } from '../features/auth/SuiteAuth'
import { OrganizationPage } from '../pages/OrganizationPage'

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
  component: () => (
    <GlobalAdministration>
      <AdministrationPage />
    </GlobalAdministration>
  ),
})
const contentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/content',
  component: () => (
    <GlobalAdministration>
      <ContentPage />
    </GlobalAdministration>
  ),
})
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})
const servicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/services',
  component: () => (
    <GlobalAdministration>
      <ServicesPage />
    </GlobalAdministration>
  ),
})
const newServiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/services/new',
  component: () => (
    <GlobalAdministration>
      <NewServicePage />
    </GlobalAdministration>
  ),
})
const serviceEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/services/$serviceId',
  component: () => (
    <GlobalAdministration>
      <ServiceEditorPage />
    </GlobalAdministration>
  ),
})
const contractRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/development/contract',
  component: () => (
    <GlobalAdministration>
      <ContractInspectorPage />
    </GlobalAdministration>
  ),
})
const publicPreviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/public-preview',
  component: () => (
    <GlobalAdministration>
      <PublicPreviewPage />
    </GlobalAdministration>
  ),
})
const organizationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/organization',
  component: OrganizationPage,
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
    contentRoute,
    organizationRoute,
  ]),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
