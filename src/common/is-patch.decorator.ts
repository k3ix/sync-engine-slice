import { registerDecorator, type ValidationArguments } from 'class-validator';

// Registered on a property no client sends, so the check sees the whole object.
const CHECKED_PROPERTY = 'isPatch';

export function IsPatch(): ClassDecorator {
  return (target) => {
    registerDecorator({
      name: 'isPatch',
      target,
      propertyName: CHECKED_PROPERTY,
      options: { message: 'a patch needs at least one field and no null values' },
      validator: {
        validate: (_: unknown, { object }: ValidationArguments) => {
          const values = Object.values(object);
          return (
            !Object.hasOwn(object, CHECKED_PROPERTY) &&
            values.length > 0 &&
            values.every((value) => value !== null)
          );
        },
      },
    });
  };
}
