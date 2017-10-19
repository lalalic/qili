const { forEachField, addSchemaLevelResolveFunction } = require('graphql-tools')

function reportRequestStart(context, queryInfo, queryContext){
	if (!context.queries) {
		context.queries = new Map(); // eslint-disable-line no-param-reassign
	}
	if (!context.queries.has(queryContext)) {
		context.queries.set(queryContext, []);
	}
	context.queries.get(queryContext).push({
		info: queryInfo,
		resolvers: [],
	});
}

function context(){
	return {
		startWallTime: +new Date(),
		startHrTime: process.hrtime(),
		resolverCalls: [],
	 }
}

// //////// Resolver Wrapping ////////

// Here we wrap resolver functions. The wrapped resolver notes start
// and end times, resolvers that return null/undefined, and
// errors. Note that a resolver is not considered finished until all
// Promises it returns (if any) have completed.

// This is applied to each resolver in the schema by instrumentSchema
// below.

const decorateField = (fn, fieldInfo) => {
  const decoratedResolver = (p, a, ctx, resolverInfo) => {
    // setup context and note start time.
    const opticsContext = ctx && ctx.opticsContext;

    if (!opticsContext) {
      // This happens when `instrumentSchema` was called, but
      // `newContext` didn't get put in the graphql context correctly.
      //
      // XXX we should report this error somehow, but logging once per
      // resolver is not good. Perhaps a "warn once" mechanism?

      return fn(p, a, ctx, resolverInfo);
    }

    const resolverReport = {
      startOffset: process.hrtime(opticsContext.startHrTime),
      fieldInfo,
      resolverInfo,
      resolverContext: ctx,
    };
    // save the report object for when we want to send query traces and to
    // aggregate its statistics at the end of the request.
    opticsContext.resolverCalls.push(resolverReport);

    // Call this when the resolver and all the Promises it returns
    // (if any) are complete.
    const finishRun = () => {
      // note end time.
      resolverReport.endOffset = process.hrtime(opticsContext.startHrTime);
    };

    // Actually run the resolver.
    let result;
    try {
      result = fn(p, a, ctx, resolverInfo);
    } catch (e) {
      // Resolver function threw during execution. Note the error and
      // re-throw.
      resolverReport.error = true;
      finishRun();
      throw e;
    }

    // Now process the results of the resolver.
    //
    // Resolver can return any of: null, undefined, string, number,
    // array[thing], or Promise[thing].
    // For primitives and arrays of primitives, fire the report immediately.
    // For Promises, fire when the Promise returns.
    // For arrays containing Promises, fire when the last Promise returns.
    //
    // Wrap in try-catch so bugs in optics-agent are less likely to break an
    // app.
    try {
      if (result === null) {
        resolverReport.resultNull = true;
      } else if (typeof result === 'undefined') {
        resolverReport.resultUndefined = true;
      } else if (typeof result.then === 'function') {
        // single Promise
        //
        // don’t throw from this promise, because it’s not one that the app
        // gets to handle, instead it operates on the original promise.
        result.then(finishRun).catch(() => {
          resolverReport.error = true;
          finishRun();
        });
        // exit early so we do not hit the default return.
        return result;
      } else if (Array.isArray(result)) {
        // array

        // collect the Promises in the array, if any.
        const promises = [];
        result.forEach((value) => {
          if (value && typeof value.then === 'function') {
            promises.push(value);
          }
        });
        // if there are Promises in the array, fire when they are all done.
        if (promises.length > 0) {
          // don’t throw from this promise, because it’s not one that the app
          // gets to handle, instead it operates on the original promise.
          Promise.all(promises).then(finishRun).catch(() => {
            resolverReport.error = true;
            finishRun();
          });
          // exit early so we do not hit the default return.
          return result;
        }
      } else {
        // primitive type. do nothing special, just default return.
      }

      // default return for non-Promise answers
      finishRun();
      return result;
    } catch (e) {
      // safety belt.
      // XXX log here!
      return result;
    }
  };

  // Add .$proxy to support graphql-sequelize.
  // See: https://github.com/mickhansen/graphql-sequelize/blob/edd4266bd55828157240fe5fe4d4381e76f041f8/src/generateIncludes.js#L37-L41
  decoratedResolver.$proxy = fn;

  return decoratedResolver;
};


// //////// Helpers ////////

// Copied from https://github.com/graphql/graphql-js/blob/v0.7.1/src/execution/execute.js#L1004
// with 'return undefined' added for clarity (and eslint)
function defaultResolveFn(source, args, context, { fieldName }) {
  // ensure source is a value for which property access is acceptable.
  if (typeof source === 'object' || typeof source === 'function') {
    const property = source[fieldName];
    if (typeof property === 'function') {
      return source[fieldName](args, context);
    }
    return property;
  }
  return undefined;
}


//  //////// Schema Wrapping ////////

// Here we take the executable schema object that graphql-js will
// execute against and add wrappings. We add both a per-schema
// wrapping that runs once per query and a per-resolver wrapping that
// runs around every resolver invocation.

const instrumentSchema = (schema) => {
  if (schema._opticsInstrumented) {
    return schema;
  }
  schema._opticsInstrumented = true;  // eslint-disable-line no-param-reassign

  // add per field instrumentation
  forEachField(schema, (field, typeName, fieldName) => {
    // If there is no resolver for a field, add the default resolve
    // function (which matches the behavior of graphql-js when there
    // is no explicit resolve function). This way we can instrument
    // it.
    if (!field.resolve) {
      field.resolve = defaultResolveFn; // eslint-disable-line no-param-reassign
    }

    field.resolve = decorateField(  // eslint-disable-line no-param-reassign
      field.resolve,
      { typeName, fieldName },
    );
  });

  // add per query instrumentation
  addSchemaLevelResolveFunction(schema, (root, args, ctx, info) => {
    const opticsContext = ctx.opticsContext;
    if (opticsContext) {
      reportRequestStart(opticsContext, info, ctx);
    }
    return root;
  });

  return schema;
};

const duration = hrtime => ((hrtime[0] * 1e9) + hrtime[1]);

exports.instrumentSchema=instrumentSchema
exports.context=context
exports.report=function(context){
	context.durationHrTime = process.hrtime(context.startHrTime);
    context.endWallTime = +new Date();
	
	const times={}
	
	function path({key,prev}){
		return `${prev ? path(prev)+'.' : ''}${key}`
	}
	
	try {
		times["."]=duration(context.durationHrTime);
		(context.resolverCalls || []).forEach(({resolverInfo,startOffset,endOffset}) => {
			let key=path(resolverInfo.path)
			times[key]=(times[key]||0)+duration(endOffset) - duration(startOffset)
		});
	} catch (e) {
		console.log('Optics error', e); 
	}	
  return times
}
