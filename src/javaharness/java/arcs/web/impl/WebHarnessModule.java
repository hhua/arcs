package arcs.web.impl;

import arcs.api.ArcsEnvironment;
import arcs.api.DeviceClient;
import arcs.api.HandleFactory;
import arcs.api.HandleFactoryImpl;
import arcs.api.HarnessController;
import arcs.api.PECInnerPortFactory;
import arcs.api.PECInnerPortFactoryImpl;
import arcs.api.ParticleExecutionContext;
import arcs.api.ParticleExecutionContextImpl;
import arcs.api.ParticleLoader;
import arcs.api.ParticleLoaderImpl;
import arcs.api.PortableJsonParser;
import arcs.api.PortablePromiseFactory;
import arcs.api.ShellApi;
import arcs.api.ShellApiBasedArcsEnvironment;
import arcs.demo.services.ClipboardService;
import dagger.Binds;
import dagger.Module;
import dagger.Provides;
import java.util.function.Consumer;
import javax.inject.Singleton;

@Module
public abstract class WebHarnessModule {

  @Binds
  @Singleton
  public abstract ArcsEnvironment provideStandaloneWebArcsEnvironment(
      ShellApiBasedArcsEnvironment impl);

  @Binds
  public abstract DeviceClient provideWebDeviceClient(DeviceClientJsImpl impl);

  @Binds
  abstract ShellApi providesWebShellApi(ShellApiImpl impl);

  @Binds
  abstract PortableJsonParser providesPortableJsonParser(PortableJsonParserImpl impl);

  @Binds
  public abstract HarnessController providesHarnessController(WebHarnessController impl);

  @Binds
  abstract ParticleExecutionContext providesParticleExecutionContext(
      ParticleExecutionContextImpl impl);

  @Binds
  abstract ParticleLoader providesParticleLoader(ParticleLoaderImpl impl);

  @Binds
  public abstract PECInnerPortFactory providesPECInnerPortFactory(PECInnerPortFactoryImpl impl);

  @Binds
  public abstract HandleFactory providesHandleFactory(HandleFactoryImpl impl);

  @Binds
  public abstract PortablePromiseFactory providesPortablePromiseFactory(
      PortablePromiseFactoryImpl impl);

  @Binds
  @Singleton
  public abstract ClipboardService provideClipboardSurface(DummyClipboard impl);
}
