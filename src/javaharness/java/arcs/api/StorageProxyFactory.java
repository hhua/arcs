package arcs.api;

public class StorageProxyFactory {
  static StorageProxy newProxy(
      String id,
      Type type,
      String name,
      PECInnerPort port,
      PortableJsonParser jsonParser,
      PortablePromiseFactory promiseFactory) {
    if (type.isCollection()) {
      return new CollectionProxy(id, type, port, name, jsonParser, promiseFactory);
    }
    // TODO: Uncomment when SingletonProxy is implemented.
    // return new SingletonProxy(id, type, port, name);
    throw new AssertionError("SingletonProxy not yet supported in Java.");
  }

  private StorageProxyFactory() {}
}
