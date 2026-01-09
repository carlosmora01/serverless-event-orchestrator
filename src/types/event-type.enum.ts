/**
 * Supported AWS event types for dispatching
 */
export enum EventType {
  EventBridge = 'eventbridge',
  ApiGateway = 'apigateway',
  Lambda = 'lambda',
  Sqs = 'sqs',
  Unknown = 'unknown',
}

/**
 * Route segments for access control categorization
 */
export enum RouteSegment {
  Public = 'public',
  Private = 'private',
  Backoffice = 'backoffice',
  Internal = 'internal',
}
