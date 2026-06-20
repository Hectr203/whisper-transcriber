@description('Nombre base para los recursos (ej. whisperapp)')
param environmentName string = 'whisperapp'

@description('Región de los recursos')
param location string = resourceGroup().location

@description('API Key por defecto para Groq')
@secure()
param groqApiKey string = ''

@description('API Key por defecto para ElevenLabs')
@secure()
param elevenLabsApiKey string = ''

var appServicePlanName = '${environmentName}-plan'
var webAppName = '${environmentName}-api'
var staticWebAppName = '${environmentName}-web'
var storageAccountName = replace(toLower('${environmentName}st'), '-', '')
var appInsightsName = '${environmentName}-ai'
var logAnalyticsName = '${environmentName}-la'

// 1. Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  tags: {
    'azd-env-name': environmentName
  }
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// 2. Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  tags: {
    'azd-env-name': environmentName
  }
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// 3. Storage Account (Para archivos temporales y persistencia si se requiere)
resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
  }
}

// Generamos la connection string del storage
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'

// 4. App Service Plan (Linux) - B1 es el mínimo recomendado para procesamiento pesado con FFmpeg
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  properties: {
    reserved: true // Requerido para Linux
  }
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
}

// 5. Azure Static Web App (Frontend - Free Tier)
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: staticWebAppName
  location: location
  tags: {
    'azd-service-name': 'frontend'
  }
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    provider: 'Custom'
  }
}

// 6. Azure App Service (Backend)
resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: webAppName
  location: location
  tags: {
    'azd-service-name': 'backend'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts'
      appCommandLine: 'npm start'
      alwaysOn: true // Habilitado en tier Basic
      appSettings: [
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'GROQ_API_KEY'
          value: groqApiKey
        }
        {
          name: 'ELEVENLABS_API_KEY'
          value: elevenLabsApiKey
        }
        {
          name: 'AZURE_STORAGE_CONNECTION_STRING'
          value: storageConnectionString
        }
        {
          name: 'CORS_ALLOWED_ORIGINS'
          value: 'https://${staticWebApp.properties.defaultHostname}'
        }
        {
          name: 'MAX_FILE_SIZE_MB'
          value: '1024' // Permitir hasta 1GB por requerimiento
        }
      ]
    }
  }
}

output apiEndpoint string = 'https://${webApp.properties.defaultHostName}'
output frontendUrl string = 'https://${staticWebApp.properties.defaultHostname}'
