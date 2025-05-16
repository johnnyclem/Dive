import {
	BaseBoxShapeUtil,
	HTMLContainer,
	TLBaseShape,
	TLShapeUtilConstructor,
} from 'tldraw'
import React from 'react' // Ensure React is in scope for JSX

// [1] Define the shape type
export type IDangerousHtmlShape = TLBaseShape<
	'html',
	{
		w: number
		h: number
		html: string
	}
>

// [2] Define the shape utility
export class DangerousHtmlUtil extends BaseBoxShapeUtil<IDangerousHtmlShape> {
	static override type = 'html' as const
	// You can optionally provide a validation schema if you need to validate props when they change
	// static override props?: Record<string, T.Validatable<any>>

	override getDefaultProps(): IDangerousHtmlShape['props'] {
		return {
			w: 500,
			h: 300,
			html: '<div><p>Hello, default HTML!</p></div>',
		}
	}

	// Render method for the shape, matching the example structure closely
	override component(shape: IDangerousHtmlShape) {
		return (
			<HTMLContainer id={shape.id} style={{ overflow: 'auto', pointerEvents: 'all' }}>
				<div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: shape.props.html }} />
			</HTMLContainer>
		)
	}

	// Indicator for selection, etc.
	override indicator(shape: IDangerousHtmlShape) {
		return <rect width={shape.props.w} height={shape.props.h} />
	}
}

// Helper to make it easily consumable as a shape utility
export const customShapeUtils: TLShapeUtilConstructor[] = [DangerousHtmlUtil]; 