type Props = React.HTMLAttributes<HTMLButtonElement>

const ButtonPrimary = ({onSubmit, children}: Props) => {
    return (
        <button className="bg-black hover:bg-gray-900 p-1 px-2 rounded border text-white cursor-pointer" onSubmit={onSubmit}>{children}</button>
    )
}

export default ButtonPrimary