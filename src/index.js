const path = require('path');

function createFilesMap(file) {
  const result = {};
  const opts = Array.isArray(file.opts.extra.aliaser)
  ? file.opts.extra.aliaser
  : (file.opts.extra.aliaser
    ? [file.opts.extra.aliaser]
    : []);

  opts.forEach(moduleMapData => {
    result[moduleMapData.expose] = moduleMapData.src;
  });
  return result;
}

function resolve(filename) {
  if (path.isAbsolute(filename)) return filename;
  return path.resolve(process.cwd(), filename);
}

export function mapToRelative(currentFile, module) {
  let from = path.dirname(currentFile);
  let to = path.normalize(module);

  from = resolve(from);
  to = resolve(to);

  let moduleMapped = path.relative(from, to);

  // Support npm modules instead of directories
  if (moduleMapped.indexOf('npm:') !== -1) {
    const [, npmModuleName] = moduleMapped.split('npm:');
    return npmModuleName;
  }

  if (moduleMapped[0] !== '.') moduleMapped = `./${moduleMapped}`;
  return moduleMapped;
}

export function mapModule(source, file, filesMap) {

  const moduleSplit = source.split('/');

  let src;
  while (moduleSplit.length) {
    const m = moduleSplit.join('/');
    if (filesMap.hasOwnProperty(m)) {
      src = filesMap[m];
      break;
    }
    moduleSplit.pop();
  }

  if (!moduleSplit.length) {
    // no mapping available
    return null;
  }

  const newPath = source.replace(moduleSplit.join('/'), src);
  return mapToRelative(file, newPath);
}

export default function ({ Plugin, types: t }) {
  function transformImportCall(nodePath, file, filesMap) {
    const moduleArg = nodePath.source;
    if (moduleArg && moduleArg.type === 'Literal') {
      const modulePath = mapModule(moduleArg.value, file.opts.filename, filesMap);
      return modulePath || null;
    }
    return null;
  }
  return new Plugin('aliaser', {
    visitor: {
      ImportDeclaration: {
        enter(a, b, c, file) {
          const modulePathToReplace = transformImportCall(a, file, createFilesMap(file));
          if (modulePathToReplace) {
            return t.importDeclaration(
              a.specifiers,
              t.literal(modulePathToReplace)
            );
          }
        }
    }
  }});
}
