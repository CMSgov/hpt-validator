export class ValidationError {
  public field: string | undefined;

  constructor(
    public path: string,
    public message: string
  ) {}

  withField(field: string): ValidationError {
    this.field = field;
    return this;
  }
}
