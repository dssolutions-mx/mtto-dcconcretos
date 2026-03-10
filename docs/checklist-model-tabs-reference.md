# Checklist Model Tabs Reference

The following components from `ModelTemplatesNavigator` provide Resumen, Activos, and Análisis functionality for equipment models. These can be leveraged for future features (e.g., model-centric dashboards, asset analysis by model).

| Tab | Component | Path | Purpose |
|-----|-----------|------|---------|
| Resumen | ModelOverviewTab | `components/checklists/tabs/model-overview-tab.tsx` | Overview stats for a model |
| Activos | AssetsTab | `components/checklists/tabs/assets-tab.tsx` | Assets using this model |
| Análisis | AnalyticsTab | `components/checklists/tabs/analytics-tab.tsx` | Analytics for the model |

The full `ModelTemplatesNavigator` (`components/checklists/model-templates-navigator.tsx`) combines model sidebar + these tabs. The plantillas section now uses a slimmer flow (sidebar + TemplatesTab only) at `/checklists/plantillas`.
