function Marker(): ClassDecorator {
  return () => {};
}

class Dependency {}

@Marker()
class Consumer {
  constructor(readonly dependency: Dependency) {}
}

class Patch {
  name?: string;
  status?: string;
}

describe('toolchain', () => {
  it('emits constructor parameter types for dependency injection', () => {
    expect(Reflect.getMetadata('design:paramtypes', Consumer)).toEqual([Dependency]);
  });

  it('leaves declared but unassigned fields off the instance', () => {
    expect(Object.keys(new Patch())).toEqual([]);
  });
});
