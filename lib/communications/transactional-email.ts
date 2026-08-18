export interface TransactionalEmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface TransactionalEmailProvider {
  send(message: TransactionalEmailMessage): Promise<void>;
}
