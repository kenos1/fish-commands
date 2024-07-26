
export function queueMicrotask(callback:() => unknown, errorHandler:(err:unknown) => unknown = (err) => {
	Log.err("Uncaught (in promise)");
	Log.err(err);
}){
	Core.app.post(() => {
		try {
			callback();
		} catch(err){
			errorHandler(err);
		}
	});
}

export class Promise<TResolve, TReject> {
	private state: ["resolved", TResolve] | ["rejected", TReject] | ["pending"] = ["pending"];
	private resolveHandlers: ((value:TResolve) => unknown)[] = [];
	private rejectHandlers: ((value:TReject) => unknown)[] = [];
	constructor(initializer:(
		resolve: (value:TResolve) => void,
		reject: (error:TReject) => void,
	) => void){
		initializer(
			(value) => {
				this.state = ["resolved", value];
				queueMicrotask(() => this.resolve());
			},
			(error) => {
				this.state = ["rejected", error];
				queueMicrotask(() => this.reject());
			}
		);
	}
	private resolve(){
		const state = this.state as ["resolved", TResolve];
		this.resolveHandlers.forEach(h => h(state[1]));
	}
	private reject(){
		const state = this.state as ["rejected", TReject];
		this.rejectHandlers.forEach(h => h(state[1]));
	}
	then<UResolve, UReject>(callback:(value:TResolve) => (UResolve | Promise<UResolve, UReject>)){
		const {promise, resolve, reject} = Promise.withResolvers<UResolve, UReject>();
		this.resolveHandlers.push(
			value => {
				const result = callback(value);
				if(result instanceof Promise){
					result.then(nextResult => resolve(nextResult));
				} else {
					resolve(result);
				}
			}
		);
		return promise;
	}
	static withResolvers<TResolve, TReject>(){
		let resolve!:(value:TResolve) => void;
		let reject!:(error:TReject) => void;
		const promise = new Promise<TResolve, TReject>((r, j) => {
			resolve = r;
			reject = j;
		})
		return {
			promise, resolve, reject
		};
	}
	static all<TResolves extends unknown[], TReject extends unknown>(
		promises:{
			[K in keyof TResolves]: Promise<TResolves[K], TReject>;
		}
	):Promise<TResolves, TReject> {
		const {promise, resolve, reject} = Promise.withResolvers<TResolves, TReject>();
		const outputs = new Array(promises.length);
		let resolutions = 0;
		promises.map((p, i) =>
			p.then(v => {
				outputs[i] = v;
				resolutions ++;
				if(resolutions == promises.length) resolve(outputs as TResolves);
			})
		);
		return promise;
	}
	static resolve<TResolve>(value:TResolve):Promise<TResolve, never> {
		return new Promise((resolve) => resolve(value));
	}
}
