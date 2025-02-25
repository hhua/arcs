package arcs.api;

import javax.inject.Inject;

public class PECInnerPortFactoryImpl implements PECInnerPortFactory {
  private final ArcsEnvironment environment;
  private final ParticleExecutionContext pec;
  private final PortableJsonParser jsonParser;
  private final PortablePromiseFactory promiseFactory;

  @Inject
  public PECInnerPortFactoryImpl(
      ArcsEnvironment environment,
      ParticleExecutionContext pec,
      PortableJsonParser jsonParser,
      PortablePromiseFactory promiseFactory) {
    this.environment = environment;
    this.pec = pec;
    this.jsonParser = jsonParser;
    this.promiseFactory = promiseFactory;
  }

  @Override
  public PECInnerPort createPECInnerPort(String id, String sessionId) {
    return new PECInnerPortImpl(id, sessionId, environment, pec, jsonParser, promiseFactory);
  }
}
