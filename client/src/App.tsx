import { lazy, Suspense } from "react";
import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { FiltersProvider, ThemeProvider } from "@/lib/app";
import NotFound from "@/pages/not-found";
// cada ecrã é um ficheiro à parte, descarregado só quando se abre (o SW pré-guarda-os todos para uso offline)
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Months = lazy(() => import("@/pages/months"));
const Parcels = lazy(() => import("@/pages/parcels"));
const Portfolio = lazy(() => import("@/pages/portfolio"));
const BudgetPage = lazy(() => import("@/pages/budget"));
const ExpensesPage = lazy(() => import("@/pages/expenses"));
const ClosingPage = lazy(() => import("@/pages/closing"));
const DataPage = lazy(() => import("@/pages/data"));
const HelpPage = lazy(() => import("@/pages/help"));
import { useFeature } from "@/lib/features";
import type { FeatureKey } from "@shared/features";
import { AccessGate } from "@/components/lock-screen";

/** Ecrã que só existe com a funcionalidade ligada; desligada, volta ao Painel. */
function FeatureRoute({ feature, component: C }: { feature: FeatureKey; component: React.ComponentType }) {
  return useFeature(feature) ? <C /> : <Redirect to="/" replace />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/meses" component={Months} />
      <Route path="/despesas" component={ExpensesPage} />
      <Route path="/fecho" component={ClosingPage} />
      <Route path="/parcelas">{() => <FeatureRoute feature="parcelas" component={Parcels} />}</Route>
      <Route path="/carteira">{() => <FeatureRoute feature="plataformas" component={Portfolio} />}</Route>
      <Route path="/orcamento" component={BudgetPage} />
      <Route path="/dados" component={DataPage} />
      <Route path="/ajuda/:slug" component={HelpPage} />
      <Route path="/ajuda" component={HelpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <FiltersProvider>
          <Toaster />
          <AccessGate>
            <Router hook={useHashLocation}>
              <Suspense fallback={<div className="p-6 text-sm text-muted-foreground" role="status">A carregar…</div>}>
                <AppRouter />
              </Suspense>
            </Router>
          </AccessGate>
        </FiltersProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
