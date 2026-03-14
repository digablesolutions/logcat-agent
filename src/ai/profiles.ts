import type { RealtimeAnalysisConfig } from './realtime/types.js';

/**
 * Predefined configurations for different analysis scenarios
 */
export const AnalysisProfiles = {
  /**
   * Development profile - balanced analysis for active development
   */
  development: {
    windowSize: 30,
    analysisInterval: 15000, // 15 seconds
    anomalyThreshold: 0.6,
    enableTrendAnalysis: true,
    enablePerformanceMonitoring: true,
    enableProactiveAnalysis: true,
    maxBufferSize: 500,
  } as RealtimeAnalysisConfig,

  /**
   * Production profile - conservative analysis for production monitoring
   */
  production: {
    windowSize: 100,
    analysisInterval: 30000, // 30 seconds
    anomalyThreshold: 0.8,
    enableTrendAnalysis: true,
    enablePerformanceMonitoring: true,
    enableProactiveAnalysis: false, // Reduce noise in production
    maxBufferSize: 1000,
  } as RealtimeAnalysisConfig,

  /**
   * Debug profile - intensive analysis for troubleshooting
   */
  debug: {
    windowSize: 20,
    analysisInterval: 5000, // 5 seconds
    anomalyThreshold: 0.5,
    enableTrendAnalysis: true,
    enablePerformanceMonitoring: true,
    enableProactiveAnalysis: true,
    maxBufferSize: 200,
  } as RealtimeAnalysisConfig,

  /**
   * Performance profile - focused on performance monitoring
   */
  performance: {
    windowSize: 50,
    analysisInterval: 10000, // 10 seconds
    anomalyThreshold: 0.7,
    enableTrendAnalysis: true,
    enablePerformanceMonitoring: true,
    enableProactiveAnalysis: false,
    maxBufferSize: 800,
  } as RealtimeAnalysisConfig,

  /**
   * Minimal profile - lightweight analysis
   */
  minimal: {
    windowSize: 50,
    analysisInterval: 60000, // 1 minute
    anomalyThreshold: 0.9,
    enableTrendAnalysis: false,
    enablePerformanceMonitoring: false,
    enableProactiveAnalysis: false,
    maxBufferSize: 300,
  } as RealtimeAnalysisConfig,
};

/**
 * Get analysis configuration by profile name
 */
export function getAnalysisProfile(profileName: string): RealtimeAnalysisConfig {
  const profile = AnalysisProfiles[profileName as keyof typeof AnalysisProfiles];
  if (!profile) {
    throw new Error(
      `Unknown analysis profile: ${profileName}. Available profiles: ${Object.keys(AnalysisProfiles).join(', ')}`
    );
  }
  return profile;
}

/**
 * List all available analysis profiles
 */
export function listAnalysisProfiles(): string[] {
  return Object.keys(AnalysisProfiles);
}

/**
 * Get profile description
 */
export function getProfileDescription(profileName: string): string {
  switch (profileName) {
    case 'development':
      return 'Balanced analysis for active development with moderate sensitivity';
    case 'production':
      return 'Conservative analysis for production monitoring with high confidence threshold';
    case 'debug':
      return 'Intensive analysis for troubleshooting with high sensitivity';
    case 'performance':
      return 'Focused on performance monitoring and optimization';
    case 'minimal':
      return 'Lightweight analysis with minimal overhead';
    default:
      return 'Custom analysis profile';
  }
}
